// 后台脚本，用于帮助调试和检测页面连接
chrome.runtime.onInstalled.addListener(() => {
  console.log('DeepSeek对话导出工具已安装');
});

// 注入内容脚本函数
function injectScript(tabId) {
  return chrome.scripting.executeScript({
    target: {tabId: tabId},
    files: ['content.js'],
    injectImmediately: true
  });
}

// 获取标签页URL
async function getTabUrl(tabId) {
  try {
    const tabs = await chrome.tabs.get(tabId);
    return tabs.url || '';
  } catch (error) {
    console.error('获取标签页URL失败:', error);
    return '';
  }
}

// 检查是否为DeepSeek页面
function isDeepSeekUrl(url) {
  return url && (
    url.includes('deepseek.com') || 
    url.includes('deepseek.ai')
  );
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('后台收到消息:', message);
  
  if (message.action === "checkConnection") {
    // 查询当前活动标签页
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        sendResponse({status: "error", message: "未找到活动标签页"});
        return;
      }
      
      const currentTab = tabs[0];
      
      // 检查是否是DeepSeek页面
      const isDeepSeekPage = isDeepSeekUrl(currentTab.url);
      
      if (!isDeepSeekPage) {
        sendResponse({
          status: "warning", 
          message: "当前页面不是DeepSeek网站，导出功能可能不正常工作"
        });
        return;
      }
      
      // 向内容脚本发送ping消息
      chrome.tabs.sendMessage(currentTab.id, {action: "ping"}, function(response) {
        if (chrome.runtime.lastError) {
          console.log('发送ping出错，尝试注入脚本:', chrome.runtime.lastError);
          // 如果出错，尝试注入脚本
          injectScript(currentTab.id)
            .then(() => {
              console.log('脚本注入成功');
              // 等待脚本加载
              setTimeout(() => {
                // 再次发送ping检查脚本是否正常工作
                chrome.tabs.sendMessage(currentTab.id, {action: "ping"}, function(pingResponse) {
                  if (chrome.runtime.lastError) {
                    console.error('重新ping失败:', chrome.runtime.lastError);
                    sendResponse({status: "error", message: "注入脚本成功，但未能建立连接"});
                  } else {
                    sendResponse({status: "injected", message: "已重新注入内容脚本"});
                  }
                });
              }, 500);
            })
            .catch(err => {
              console.error('脚本注入失败:', err);
              sendResponse({status: "error", message: "注入脚本失败: " + err.message});
            });
        } else {
          console.log('Ping成功，连接正常');
          sendResponse({status: "connected", message: "连接正常"});
        }
      });
    });
    
    return true; // 保持消息通道开放以便异步响应
  }
  
  // 处理注入并导出的请求
  if (message.action === "injectAndExport") {
    const { tabId, format, conversationType } = message;
    
    // 先检查是否为DeepSeek页面
    getTabUrl(tabId).then(url => {
      if (!isDeepSeekUrl(url)) {
        sendResponse({
          success: false, 
          error: "当前页面不是DeepSeek网站，请在DeepSeek聊天页面使用"
        });
        return;
      }
      
      // 是DeepSeek页面，执行注入和导出
      injectScript(tabId)
        .then(() => {
          console.log('导出前脚本注入成功');
          
          // 等待脚本加载
          setTimeout(() => {
            // 注入成功后发送导出请求
            chrome.tabs.sendMessage(
              tabId, 
              {
                action: "export", 
                format: format,
                conversationType: conversationType
              },
              function(response) {
                if (chrome.runtime.lastError) {
                  console.error("导出请求失败:", chrome.runtime.lastError);
                  sendResponse({success: false, error: "导出失败: " + chrome.runtime.lastError.message});
                } else {
                  console.log('导出响应:', response);
                  sendResponse(response || {success: true});
                }
              }
            );
          }, 800); // 给脚本加载留出足够时间
        })
        .catch(err => {
          console.error('脚本注入失败:', err);
          sendResponse({success: false, error: "注入脚本失败: " + err.message});
        });
    });
    
    return true; // 保持消息通道开放以便异步响应
  }
}); 