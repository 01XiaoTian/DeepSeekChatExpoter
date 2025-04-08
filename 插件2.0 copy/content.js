console.log('DeepSeek Exporter content script loaded at:', window.location.href);  // 添加调试日志

// 立即发送初始化消息
chrome.runtime.sendMessage({
  type: 'CONTENT_SCRIPT_LOADED',
  url: window.location.href
});

console.log('DeepSeek Exporter content script loaded');  // 添加调试日志

// Listen for a message from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Received message:', request);  // 添加调试日志
  
  if (request.action === "extractData") {
    try {
      const messages = [];
      
      // 获取所有对话块
      const chatBlocks = document.querySelectorAll('[class*="message-"]');
      
      chatBlocks.forEach(block => {
        // 判断消息类型
        const isAssistant = block.classList.contains('message-assistant');
        const role = isAssistant ? 'assistant' : 'user';
        
        // 获取主要内容
        const mainContent = block.querySelector('.prose');
        let content = mainContent ? mainContent.innerText : '';
        
        // 获取思考过程 (如果存在)
        const thoughtProcess = block.querySelector('.thinking-process');
        const thoughts = thoughtProcess ? thoughtProcess.innerText : '';
        
        // 获取引用或参考内容 (如果存在)
        const references = block.querySelector('.references');
        const refs = references ? references.innerText : '';
        
        // 组装完整内容
        let fullContent = content;
        if (thoughts) {
          fullContent += '\n\n思考过程:\n' + thoughts;
        }
        if (refs) {
          fullContent += '\n\n参考资料:\n' + refs;
        }

        // 清理内容格式
        fullContent = fullContent
          .replace(/\u00A0/g, ' ') // 替换不间断空格
          .replace(/\r\n/g, '\n')  // 统一换行符
          .trim();

        if (fullContent) {
          messages.push({
            role: role,
            content: fullContent,
            timestamp: new Date().toLocaleString('zh-CN')
          });
        }
      });

      const conversation = {
        metadata: {
          exportDate: new Date().toISOString(),
          source: 'DeepSeek Chat',
          version: '1.0',
          url: window.location.href
        },
        messages: messages
      };

      sendResponse({ data: conversation });
    } catch (error) {
      console.error('Error in content script:', error);
      sendResponse({ error: error.message });
    }
  }
  return true;  // 保持消息通道开放
});
