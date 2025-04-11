// Global variables
let activeTool = null;
let tooltip = null;
let eyeDropper = null;
let isColorPickerActive = false;

// Initialize when content script loads
console.log("Web Inspector content script loaded successfully");

// Check if browser supports EyeDropper API
const supportsEyeDropper = "EyeDropper" in window;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in content script:", request);
  
  if (request.action === "activateColorPicker") {
    pickColor()
      .then(result => {
        console.log("Color picker result:", result);
        sendResponse({success: true});
      })
      .catch(err => {
        console.error("Color picker error:", err);
        sendResponse({success: false, error: err.message});
      });
  } else if (request.action === "activateFontAnalyzer") {
    activateFontAnalyzer();
    sendResponse({success: true});
  }
  
  return true; // Required for asynchronous sendResponse
});

// Main color picker function
async function pickColor() {
  // Make sure any previous tool is deactivated
  deactivateCurrentTool();
  
  // Set current tool
  activeTool = "color";
  isColorPickerActive = true;
  
  try {
    // Check if EyeDropper API is supported
    if (supportsEyeDropper) {
      showTooltip("🎨 Click anywhere to pick a color");
      
      // Create eye dropper instance if not already created
      if (!eyeDropper) {
        eyeDropper = new EyeDropper();
      }
      
      try {
        // Open the eye dropper
        const result = await eyeDropper.open();
        
        if (result && result.sRGBHex) {
          const color = result.sRGBHex;
          
          // Convert hex to RGB
          const rgbColor = hexToRgb(color);
          
          // Send color to background script
          chrome.runtime.sendMessage({ 
            action: "addColor", 
            color: color,
            rgbColor: rgbColor
          }, response => {
            console.log("Color saved response:", response);
          });
          
          showTooltip(`🎨 Saved: ${color}`);
          setTimeout(removeTooltip, 1500);
          return { success: true, color };
        }
      } catch (err) {
        console.error("EyeDropper error:", err);
        
        // If user cancelled or there was another error, try fallback
        if (err.name === "AbortError") {
          console.log("User cancelled EyeDropper, trying fallback");
        }
        
        // Use fallback color picker
        showTooltip("⚠️ Using fallback color picker");
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for user to see tooltip
        return await useFallbackColorPicker();
      }
    } else {
      // Use fallback color picker if EyeDropper isn't supported
      showTooltip("⚠️ Browser doesn't support EyeDropper API");
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for user to see tooltip
      return await useFallbackColorPicker();
    }
  } catch (err) {
    console.error("Color picker general error:", err);
    showTooltip("❌ Error with color picking");
    setTimeout(removeTooltip, 2000);
    throw err;
  } finally {
    // Always ensure cleanup happens
    isColorPickerActive = false;
  }
}

// Promise-based fallback color picker
function useFallbackColorPicker() {
  return new Promise((resolve, reject) => {
    let isSelecting = true;
    let originalCursor = document.body.style.cursor;
    
    document.body.style.cursor = 'crosshair';
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '9999999';
    overlay.style.cursor = 'crosshair';
    overlay.style.backgroundColor = 'transparent';
    
    // Create preview box
    const previewBox = document.createElement('div');
    previewBox.style.position = 'fixed';
    previewBox.style.width = '120px';
    previewBox.style.height = '60px';
    previewBox.style.borderRadius = '4px';
    previewBox.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
    previewBox.style.color = '#FFF';
    previewBox.style.padding = '10px';
    previewBox.style.fontSize = '12px';
    previewBox.style.zIndex = '9999999';
    previewBox.style.pointerEvents = 'none';
    previewBox.style.display = 'flex';
    previewBox.style.flexDirection = 'column';
    previewBox.style.alignItems = 'center';
    previewBox.style.fontFamily = 'Arial, sans-serif';
    previewBox.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    
    // Color preview square
    const colorSquare = document.createElement('div');
    colorSquare.style.width = '30px';
    colorSquare.style.height = '30px';
    colorSquare.style.border = '2px solid white';
    colorSquare.style.borderRadius = '4px';
    colorSquare.style.marginBottom = '5px';
    
    // Color text
    const colorText = document.createElement('span');
    colorText.style.fontFamily = 'monospace';
    colorText.style.fontSize = '14px';
    
    previewBox.appendChild(colorSquare);
    previewBox.appendChild(colorText);
    
    // Add to document
    document.body.appendChild(overlay);
    document.body.appendChild(previewBox);
    
    function getColorAtPoint(x, y) {
      // Remove overlay and preview temporarily
      document.body.removeChild(overlay);
      document.body.removeChild(previewBox);
      
      // Get element at point
      const element = document.elementFromPoint(x, y);
      let color = '#FFFFFF';
      
      if (element) {
        const style = window.getComputedStyle(element);
        
        // Try to get the most visible color
        if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
          color = style.backgroundColor;
        } else if (style.color) {
          color = style.color;
        }
      }
      
      // Put overlay and preview back
      document.body.appendChild(overlay);
      document.body.appendChild(previewBox);
      
      return color;
    }
    
    function handleMouseMove(e) {
      if (!isSelecting) return;
      
      // Update preview position
      let x = e.clientX + 20;
      let y = e.clientY + 20;
      
      // Keep in viewport
      if (x + 130 > window.innerWidth) x = e.clientX - 140;
      if (y + 70 > window.innerHeight) y = e.clientY - 80;
      
      previewBox.style.left = `${x}px`;
      previewBox.style.top = `${y}px`;
      
      // Get color at cursor position
      const color = getColorAtPoint(e.clientX, e.clientY);
      const hexColor = rgbToHex(color);
      
      // Update preview
      colorSquare.style.backgroundColor = hexColor;
      colorText.textContent = hexColor;
    }
    
    function handleClick(e) {
      if (!isSelecting) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const color = getColorAtPoint(e.clientX, e.clientY);
      const hexColor = rgbToHex(color);
      const rgbColor = color.startsWith('rgb') ? color : hexToRgb(hexColor);
      
      // Send color to background script
      chrome.runtime.sendMessage({ 
        action: "addColor", 
        color: hexColor,
        rgbColor: rgbColor
      }, response => {
        console.log("Color saved response:", response);
      });
      
      showTooltip(`🎨 Saved: ${hexColor}`);
      
      // Clean up
      cleanupFallbackPicker();
      
      setTimeout(removeTooltip, 1500);
      
      // Resolve the promise with success
      resolve({ success: true, color: hexColor });
    }
    
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        cleanupFallbackPicker();
        reject(new Error("User cancelled fallback color picker"));
      }
    }
    
    function cleanupFallbackPicker() {
      isSelecting = false;
      document.body.style.cursor = originalCursor;
      
      overlay.removeEventListener('mousemove', handleMouseMove);
      overlay.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      
      if (overlay.parentNode) overlay.remove();
      if (previewBox.parentNode) previewBox.remove();
    }
    
    // Add event listeners
    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    
    // Set a timeout to avoid the picker hanging forever
    setTimeout(() => {
      if (isSelecting) {
        cleanupFallbackPicker();
        reject(new Error("Color picker timed out"));
      }
    }, 60000); // 1 minute timeout
  });
}

// Convert hex color to RGB format
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse the RGB components
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgb(${r}, ${g}, ${b})`;
}

// Convert RGB color to hex format
function rgbToHex(rgb) {
  if (!rgb) return "#000000";
  if (rgb.startsWith("#")) return rgb.toUpperCase();
  
  // Handle rgb() and rgba() formats
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (!match) return "#000000";
  
  const [, r, g, b] = match.map(Number);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

// Font analyzer functionality
function activateFontAnalyzer() {
  deactivateCurrentTool();
  activeTool = "font";
  showTooltip("🔍 Select some text to analyze");

  document.addEventListener("mouseup", handleTextSelection);
  document.addEventListener("keydown", handleEscapeKey);
}

// Handle text selection for font analysis
function handleTextSelection(event) {
  if (activeTool !== "font") return;

  const selection = window.getSelection();
  if (!selection || selection.toString().trim() === "") return;

  try {
    const range = selection.getRangeAt(0);
    const node = selection.anchorNode?.parentElement;

    if (!node) return;

    const style = window.getComputedStyle(node);
    const fontDetails = {
      family: style.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
      size: style.fontSize,
      weight: style.fontWeight,
      style: style.fontStyle,
      color: rgbToHex(style.color)
    };

    console.log("Font details detected:", fontDetails);

    const rect = range.getBoundingClientRect();
    showTooltip(
      `${fontDetails.family}, ${fontDetails.size}, ${fontDetails.weight}, ${fontDetails.style}, ${fontDetails.color}`,
      rect.right + window.scrollX + 10,
      rect.top + window.scrollY + 10
    );

    // Send message to background script
    chrome.runtime.sendMessage({ 
      action: "addFont", 
      font: fontDetails 
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error sending font data:", chrome.runtime.lastError);
      } else {
        console.log("Font data sent successfully:", response);
      }
    });

    // Don't deactivate immediately to allow user to make multiple selections
    setTimeout(() => {
      removeTooltip();
    }, 2500);
  } catch (err) {
    console.error("Font analysis error:", err);
    removeTooltip();
  }
}

// Tooltip utility functions
function showTooltip(text, x = window.innerWidth / 2, y = 80) {
  removeTooltip();

  tooltip = document.createElement("div");
  tooltip.textContent = text;
  tooltip.style.position = "fixed";
  tooltip.style.top = `${y}px`;
  tooltip.style.left = `${x}px`;
  tooltip.style.transform = "translateX(-50%)";
  tooltip.style.background = "rgba(0,0,0,0.85)";
  tooltip.style.color = "#fff";
  tooltip.style.padding = "8px 12px";
  tooltip.style.borderRadius = "6px";
  tooltip.style.fontSize = "12px";
  tooltip.style.fontFamily = "Segoe UI, sans-serif";
  tooltip.style.zIndex = "9999999";
  tooltip.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
  tooltip.style.pointerEvents = "none";
  document.body.appendChild(tooltip);
}

function removeTooltip() {
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
}

// Utility functions
function deactivateCurrentTool() {
  if (activeTool === "font") {
    document.removeEventListener("mouseup", handleTextSelection);
    document.removeEventListener("keydown", handleEscapeKey);
  } else if (activeTool === "color") {
    // Any cleanup needed for color picker
    if (isColorPickerActive) {
      // Force cancel any active eye dropper
      if (eyeDropper) {
        // We can't directly cancel the eye dropper, but we can clean up other resources
        isColorPickerActive = false;
      }
    }
  }
  removeTooltip();
  activeTool = null;
}

function handleEscapeKey(e) {
  if (e.key === "Escape") {
    deactivateCurrentTool();
  }
}

// Cleanup for color picker
function cleanupColorPicker() {
  isColorPickerActive = false;
  // Any additional cleanup needed
}

// Force initialize to show we've loaded successfully
console.log("Web Inspector content script loaded successfully");