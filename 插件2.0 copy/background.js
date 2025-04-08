// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('DeepSeek Conversation Exporter installed.');
});

// 添加消息中继
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.type === 'INJECT_CONTENT_SCRIPT') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          files: ['content.js']
        }).then(() => {
          sendResponse({success: true});
        }).catch((err) => {
          console.error('Script injection failed:', err);
          sendResponse({error: err.message});
        });
      }
    });
    return true;
  }

  if (request.type === 'ERROR') {
    console.error('Export error:', request.error);
  }
  if (request.type === 'SUCCESS') {
    console.log('Export successful:', request.data);
  }
});
