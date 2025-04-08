document.addEventListener('DOMContentLoaded', function() {
  const exportButton = document.getElementById('exportButton');
  const formatSelect = document.getElementById('formatSelect');

  exportButton.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      if (!tab) {
        throw new Error('找不到活动标签页');
      }

      if (!tab.url.includes('chat.deepseek.com')) {
        alert('请在 DeepSeek Chat 页面使用此插件');
        return;
      }

      // 修改注入逻辑
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['utils.js', 'content.js']
        });
      } catch (e) {
        console.log('Script already injected or injection failed:', e);
      }

      // 增加延迟确保脚本完全加载
      await new Promise(resolve => setTimeout(resolve, 500));

      // 发送消息到content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "extractData"
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      if (response && response.data) {
        const format = formatSelect.value;
        const formattedContent = formatExport(response.data, format);
        downloadFile(formattedContent, format);
      } else {
        throw new Error('未能获取对话数据');
      }
    } catch (error) {
      console.error('Export error:', error);
      if (error.message.includes('Receiving end does not exist')) {
        alert('请刷新页面后重试');
      } else {
        alert('导出失败: ' + (error.message || '未知错误'));
      }
    }
  });
});
