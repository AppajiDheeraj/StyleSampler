// background.js - Complete implementation for Web Inspector extension

// Global state management
let activeTab = null;

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Web Inspector extension installed or updated');

  // Set default settings if not already set
  chrome.storage.sync.get(['colorHistory', 'fontHistory', 'darkMode'], (data) => {
    // Initialize color history if not present
    if (!data.colorHistory) {
      chrome.storage.sync.set({ colorHistory: [] });
    }

    // Initialize font history if not present
    if (!data.fontHistory) {
      chrome.storage.sync.set({ fontHistory: [] });
    }

    // Initialize dark mode preference if not present
    if (data.darkMode === undefined) {
      chrome.storage.sync.set({ darkMode: false });
    }
  });
});

// Helper function to store color in storage
function storeColorInStorage(color) {
  console.log('Storing color in storage:', color);
  chrome.storage.sync.get('colorHistory', (data) => {
    let colorHistory = data.colorHistory || [];
    
    // Add color if it doesn't exist already
    if (!colorHistory.includes(color)) {
      colorHistory.unshift(color); // Add to the beginning
      
      // Limit history size to prevent storage issues
      if (colorHistory.length > 20) {
        colorHistory.pop();
      }
      
      chrome.storage.sync.set({ colorHistory }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error storing color:', chrome.runtime.lastError);
        } else {
          console.log('Color history updated:', colorHistory);
        }
      });
    }
  });
}

// Helper function to store font in storage
function storeFontInStorage(font) {
  console.log('Storing font in storage:', font);
  chrome.storage.sync.get('fontHistory', (data) => {
    let fontHistory = data.fontHistory || [];
    
    // Create a string representation to check for duplicates
    const fontString = JSON.stringify(font);
    
    // Check if this font is already in history
    const exists = fontHistory.some(item => JSON.stringify(item) === fontString);
    
    if (!exists) {
      fontHistory.unshift(font); // Add to the beginning
      
      // Limit history size to prevent storage issues
      if (fontHistory.length > 20) {
        fontHistory.pop();
      }
      
      chrome.storage.sync.set({ fontHistory }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error storing font:', chrome.runtime.lastError);
        } else {
          console.log('Font history updated:', fontHistory);
        }
      });
    }
  });
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Background received message:", message);
    
    if (message.action === "captureVisibleTab") {
      chrome.tabs.captureVisibleTab(null, {format: 'png'}, dataUrl => {
        sendResponse({dataUrl: dataUrl});
      });
      return true; // Keep the messaging channel open for async response
    } 
    else if (message.action === "addColor") {
      storeColorInStorage(message.color);
      sendResponse({ success: true });
    }
    else if (message.action === "addFont") {
      storeFontInStorage(message.font);
      sendResponse({ success: true });
    }
    else if (message.action === "clearColorHistory") {
      chrome.storage.sync.set({ colorHistory: [] }, () => {
        sendResponse({ success: true });
      });
      return true; // Keep the message channel open for async response
    }
    else if (message.action === "clearFontHistory") {
      chrome.storage.sync.set({ fontHistory: [] }, () => {
        sendResponse({ success: true });
      });
      return true; // Keep the message channel open for async response
    }
    else if (message.action === "getActiveTab") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          activeTab = tabs[0];
          sendResponse({ tab: activeTab });
        } else {
          sendResponse({ error: "No active tab found" });
        }
      });
      return true; // Keep the message channel open for async response
    }
    
    return true; // Keep the message channel open for other potential async responses
  });

// Keep track of active tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    activeTab = tab;
  });
});

// Update active tab info when tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    activeTab = tab;
  }
});
