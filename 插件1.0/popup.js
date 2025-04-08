document.addEventListener('DOMContentLoaded', function() {
    // 状态显示函数
    function showStatus(message, isError = false) {
      const statusElement = document.getElementById('status');
      statusElement.textContent = message;
      statusElement.style.color = isError ? '#e53935' : '#4caf50';
      
      // 显示错误消息时保持显示，否则3秒后消失
      if (!isError) {
        setTimeout(() => {
          if (statusElement.textContent === message) {
            statusElement.textContent = '';
          }
        }, 3000);
      }
    }
  
    // 检查页面连接状态
    function checkConnection() {
      showStatus("正在检测连接...");
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || tabs.length === 0) {
          showStatus("未找到活动标签页", true);
          return;
        }
        
        const currentTab = tabs[0];
        
        // 检查是否是DeepSeek页面
        const isDeepSeekPage = currentTab.url && (
          currentTab.url.includes('deepseek.com') || 
          currentTab.url.includes('deepseek.ai')
        );
        
        if (!isDeepSeekPage) {
          showStatus("当前不是DeepSeek页面，请在DeepSeek聊天页面使用", true);
          enableExportButtons(false);
          return;
        }
        
        // 发送连接检查请求到后台脚本
        chrome.runtime.sendMessage(
          {action: "checkConnection"}, 
          function(response) {
            if (chrome.runtime.lastError) {
              showStatus("连接检查失败: " + chrome.runtime.lastError.message, true);
              return;
            }
            
            if (response && response.status === "connected") {
              showStatus("已连接到DeepSeek");
              enableExportButtons(true);
            } else if (response && response.status === "injected") {
              showStatus("已准备好，可以开始导出");
              enableExportButtons(true);
            } else if (response && response.status === "warning") {
              showStatus(response.message, true);
              enableExportButtons(true);
            } else {
              showStatus(response ? response.message : "连接失败", true);
              enableExportButtons(false);
            }
          }
        );
      });
    }
    
    // 启用或禁用导出按钮
    function enableExportButtons(enabled) {
      const buttons = [
        document.getElementById('export-word'),
        document.getElementById('export-pdf'),
        document.getElementById('export-md')
      ];
      
      buttons.forEach(button => {
        if (button) {
          button.disabled = !enabled;
          button.style.opacity = enabled ? '1' : '0.5';
          button.style.cursor = enabled ? 'pointer' : 'not-allowed';
        }
      });
    }
  
    // 直接发送导出请求到内容脚本
    function exportConversation(format) {
      const conversationType = document.getElementById('conversation-select').value;
      showStatus("正在准备导出...");
      
      // 禁用按钮避免重复点击
      enableExportButtons(false);
      
      // 查询当前活动标签页
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || tabs.length === 0) {
          showStatus("未找到活动标签页", true);
          enableExportButtons(true);
          return;
        }
        
        // 直接发送消息到内容脚本
        chrome.tabs.sendMessage(
          tabs[0].id, 
          {
            action: "export", 
            format: format,
            conversationType: conversationType
          },
          function(response) {
            if (chrome.runtime.lastError) {
              console.error("发送消息错误:", chrome.runtime.lastError);
              
              // 尝试通过background注入脚本并重试
              chrome.runtime.sendMessage(
                {action: "injectAndExport", tabId: tabs[0].id, format: format, conversationType: conversationType},
                function(bgResponse) {
                  if (bgResponse && bgResponse.success) {
                    showStatus("导出成功！");
                  } else {
                    const errorMsg = bgResponse && bgResponse.error ? 
                      bgResponse.error : 
                      "导出失败，请确保在DeepSeek页面对话页面";
                    showStatus(errorMsg, true);
                  }
                  enableExportButtons(true);
                }
              );
            } else if (response && response.success) {
              showStatus("导出成功！");
              enableExportButtons(true);
            } else if (response && response.error) {
              showStatus("导出失败: " + response.error, true);
              enableExportButtons(true);
            } else {
              showStatus("导出失败，未收到响应", true);
              enableExportButtons(true);
            }
          }
        );
      });
    }
  
    // 绑定按钮点击事件
    document.getElementById('export-word').addEventListener('click', function() {
      exportConversation("docx");
    });
    
    document.getElementById('export-pdf').addEventListener('click', function() {
      exportConversation("pdf");
    });
    
    document.getElementById('export-md').addEventListener('click', function() {
      exportConversation("md");
    });
  
    // 页面加载时检查连接状态
    checkConnection();
    
    // 监听标签页变化，自动重新检查连接
    chrome.tabs.onActivated.addListener(function() {
      setTimeout(checkConnection, 500);
    });
    
    showStatus("准备就绪");
  });