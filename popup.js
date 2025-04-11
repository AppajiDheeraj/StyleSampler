document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const themeToggle = document.getElementById('theme-toggle');
  const colorsTab = document.getElementById('colors-tab');
  const fontsTab = document.getElementById('fonts-tab');
  const activateButton = document.getElementById('activate-tool');
  const colorHistoryContainer = document.getElementById('color-history-container');
  const fontHistoryContainer = document.getElementById('font-history-container');
  const colorHistoryList = document.getElementById('color-history');
  const fontHistoryList = document.getElementById('font-history');

  // Current view state
  let currentView = 'colors'; // 'colors' or 'fonts'

  // Set initial active tab
  colorsTab.classList.add('active');

  // Check stored theme preference
  chrome.storage.sync.get('darkMode', function(data) {
    if (data.darkMode) {
      document.body.classList.add('dark-theme');
    }
  });

  // Toggle theme
  themeToggle.addEventListener('click', function() {
    document.body.classList.toggle('dark-theme');
    chrome.storage.sync.set({
      'darkMode': document.body.classList.contains('dark-theme')
    });
  });

  // Tab switching - Colors
  colorsTab.addEventListener('click', function() {
    currentView = 'colors';
    colorsTab.classList.add('active');
    fontsTab.classList.remove('active');
    activateButton.textContent = 'Activate Color Picker';
    activateButton.style.backgroundColor = ''; // Reset to default color
    colorHistoryContainer.style.display = 'block';
    fontHistoryContainer.style.display = 'none';
  });

  // Tab switching - Fonts
  fontsTab.addEventListener('click', function() {
    currentView = 'fonts';
    fontsTab.classList.add('active');
    colorsTab.classList.remove('active');
    activateButton.textContent = 'Activate Font Analyzer';
    activateButton.style.backgroundColor = '#5d5fef'; // Purple for font analyzer
    colorHistoryContainer.style.display = 'none';
    fontHistoryContainer.style.display = 'block';
  });
  
  // Activate button click
  activateButton.addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length === 0) {
        console.error("No active tab found");
        alert("⚠️ Unable to find active tab. Please try again.");
        return;
      }
  
      const message = currentView === 'colors'
        ? { action: "activateColorPicker" }
        : { action: "activateFontAnalyzer" };
  
      try {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Error sending message to content script:", chrome.runtime.lastError.message);
            
            // Check if we need to inject the content script
            if (chrome.runtime.lastError.message.includes("Could not establish connection") || 
                chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
              
              // Inject content script programmatically
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['content.js']
              }, () => {
                if (chrome.runtime.lastError) {
                  alert("⚠️ Cannot run on this page. Please try on a regular website.");
                } else {
                  // Retry sending the message after injecting
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabs[0].id, message);
                    window.close();
                  }, 100);
                }
              });
              return;
            }
            
            alert("⚠️ Please open a real website to use this tool. It doesn't work on this page.");
            return;
          }
  
          // If message was successfully sent, close popup
          window.close();
        });
      } catch (err) {
        console.error("Failed to send message:", err);
        alert("⚠️ An error occurred. Please try again on a different page.");
      }
    });
  });

  // Load history from storage
  loadHistory();

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "addColor") {
      addColorToHistory(request.color);
      sendResponse({success: true});
    } else if (request.action === "addFont") {
      addFontToHistory(request.font);
      sendResponse({success: true});
    }
    return true; // Keep the message channel open for async response
  });

  // Load color and font history
  function loadHistory() {
    chrome.storage.sync.get(['colorHistory', 'fontHistory'], function(data) {
      if (data.colorHistory) {
        renderColorHistory(data.colorHistory);
      }
      if (data.fontHistory) {
        renderFontHistory(data.fontHistory);
      }
    });
  }

  // Render color history
  function renderColorHistory(colors) {
    colorHistoryList.innerHTML = '';
    
    if (!colors || colors.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.textContent = 'No colors saved yet';
      emptyMessage.style.opacity = '0.7';
      emptyMessage.style.textAlign = 'center';
      emptyMessage.style.padding = '10px';
      colorHistoryList.appendChild(emptyMessage);
      return;
    }
    
    colors.forEach(color => {
      const listItem = document.createElement('li');
      listItem.className = 'history-item';
      
      const colorPreview = document.createElement('div');
      colorPreview.className = 'color-preview';
      colorPreview.style.backgroundColor = color;
      
      const colorText = document.createElement('span');
      colorText.className = 'history-text';
      colorText.textContent = color.toUpperCase();
      
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-btn';
      copyButton.innerHTML = '📋';
      copyButton.title = 'Copy to clipboard';
      copyButton.addEventListener('click', function() {
        navigator.clipboard.writeText(color).then(function() {
          // Flash feedback
          copyButton.innerHTML = '✓';
          setTimeout(() => {
            copyButton.innerHTML = '📋';
          }, 1000);
        });
      });
      
      listItem.appendChild(colorPreview);
      listItem.appendChild(colorText);
      listItem.appendChild(copyButton);
      colorHistoryList.appendChild(listItem);
    });
  }

  // Render font history
  function renderFontHistory(fonts) {
    fontHistoryList.innerHTML = '';
    
    if (!fonts || fonts.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.textContent = 'No fonts analyzed yet';
      emptyMessage.style.opacity = '0.7';
      emptyMessage.style.textAlign = 'center';
      emptyMessage.style.padding = '10px';
      fontHistoryList.appendChild(emptyMessage);
      return;
    }
    
    fonts.forEach(font => {
      const listItem = document.createElement('li');
      listItem.className = 'history-item';
      
      const fontPreview = document.createElement('div');
      fontPreview.className = 'font-preview';
      
      const fontName = document.createElement('div');
      fontName.className = 'font-name';
      fontName.textContent = font.family;
      fontName.style.fontFamily = font.family;
      
      const fontSpecs = document.createElement('div');
      fontSpecs.className = 'font-specs';
      fontSpecs.textContent = `${font.size} ${font.weight} ${font.style} ${font.color}`;
      if (font.color) {
        fontSpecs.style.color = font.color;
      }
      
      fontPreview.appendChild(fontName);
      fontPreview.appendChild(fontSpecs);
      
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-btn';
      copyButton.innerHTML = '📋';
      copyButton.title = 'Copy to clipboard';
      copyButton.addEventListener('click', function() {
        const fontString = `Font: ${font.family}, Size: ${font.size}, Weight: ${font.weight}, Style: ${font.style}, Color: ${font.color}`;
        navigator.clipboard.writeText(fontString).then(function() {
          copyButton.innerHTML = '✓';
          setTimeout(() => {
            copyButton.innerHTML = '📋';
          }, 1000);
        });
      });
      
      listItem.appendChild(fontPreview);
      listItem.appendChild(copyButton);
      fontHistoryList.appendChild(listItem);
    });
  }

  // Add color to history
  function addColorToHistory(color) {
    chrome.storage.sync.get('colorHistory', function(data) {
      let colorHistory = data.colorHistory || [];
      
      // Remove if already exists to avoid duplicates
      colorHistory = colorHistory.filter(item => item !== color);
      
      // Add to beginning of array
      colorHistory.unshift(color);
      
      // Limit to max history items
      if (colorHistory.length > 5) {
        colorHistory = colorHistory.slice(0, 5);
      }
      
      // Save to storage
      chrome.storage.sync.set({colorHistory: colorHistory}, function() {
        renderColorHistory(colorHistory);
      });
    });
  }

  // Add font to history
  function addFontToHistory(font) {
    chrome.storage.sync.get('fontHistory', function(data) {
      let fontHistory = data.fontHistory || [];
      
      // Check if font already exists
      const fontExists = fontHistory.some(item => 
        item.family === font.family && 
        item.size === font.size && 
        item.weight === font.weight && 
        item.style === font.style && 
        item.color === font.color
      );
      
      if (!fontExists) {
        // Add to beginning of array
        fontHistory.unshift(font);
        
        // Limit to max history items
        if (fontHistory.length > 5) {
          fontHistory = fontHistory.slice(0, 5);
        }
        
        // Save to storage
        chrome.storage.sync.set({fontHistory: fontHistory}, function() {
          renderFontHistory(fontHistory);
        });
      }
    });
  }
});