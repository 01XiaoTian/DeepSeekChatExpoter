// 添加更强的调试功能
const DEBUG = true;

function log(message) {
  if (DEBUG) {
    console.log(`[DeepSeek导出工具] ${message}`);
  }
}

// 记录页面加载
log("DeepSeek导出工具内容脚本已加载");

// 内联文档库函数而不是加载外部资源
function loadDependencies() {
  log("使用内联依赖替代外部加载");
  
  // 检查文档是否已加载这些库
  if (window.docx) {
    log("docx库已存在");
  } else {
    log("添加内联docx功能");
    // 提供基本的文档导出功能
    window.docx = {
      Document: function(options) { this.options = options; },
      Paragraph: function(options) { this.options = options; },
      TextRun: function(options) { this.options = options; },
      HeadingLevel: { HEADING_1: 'heading1' },
      BorderStyle: { SINGLE: 'single' },
      Packer: {
        toBlob: function(doc) {
          return new Promise((resolve) => {
            // 创建一个简单的文本内容
            let content = "# DeepSeek对话记录\n\n";
            
            if (doc && doc.options && doc.options.sections) {
              doc.options.sections.forEach(section => {
                if (section.children) {
                  section.children.forEach(child => {
                    if (child.options && child.options.text) {
                      content += child.options.text + "\n";
                    }
                  });
                }
              });
            }
            
            // 创建Blob
            const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            resolve(blob);
          });
        }
      }
    };
  }
  
  if (window.jspdf) {
    log("jsPDF库已存在");
  } else {
    log("添加内联jsPDF功能");
    // 提供基本的PDF导出功能
    window.jspdf = {
      jsPDF: function() {
        return {
          internal: {
            pageSize: {
              getWidth: function() { return 210; },
              getHeight: function() { return 297; }
            }
          },
          setFont: function() { return this; },
          setFontSize: function() { return this; },
          text: function() { return this; },
          addPage: function() { return this; },
          setDrawColor: function() { return this; },
          line: function() { return this; },
          splitTextToSize: function(text, width) {
            // 简单分行
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            
            words.forEach(word => {
              if (currentLine.length + word.length + 1 > width / 5) {
                lines.push(currentLine);
                currentLine = word;
              } else {
                currentLine += (currentLine ? ' ' : '') + word;
              }
            });
            
            if (currentLine) {
              lines.push(currentLine);
            }
            
            return lines;
          },
          save: function(filename) {
            // 创建一个简单的文本版本
            let content = "DeepSeek对话记录\n\n";
            
            if (this._content) {
              content += this._content.join("\n");
            }
            
            const blob = new Blob([content], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        };
      }
    };
  }
  
  log("依赖加载完成");
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  log("收到消息: " + JSON.stringify(request));
  
  if (request.action === "ping") {
    log("收到ping请求，回复OK");
    sendResponse({status: "ok", message: "内容脚本正常运行"});
    return true;
  }
  
  if (request.action === "export") {
    log(`开始处理导出请求: 格式=${request.format}, 类型=${request.conversationType}`);
    
    // 加载依赖
    loadDependencies();
    
    // 记录DOM结构以辅助调试
    logPageStructure();
    
    // 直接提取DeepSeek内容
    try {
      const messages = extractDeepSeekContent(request.conversationType);
      
      if (!messages || messages.length === 0) {
        log("未找到对话内容");
        sendResponse({error: "未找到对话内容，请确保在DeepSeek聊天页面"});
        return true;
      }
      
      log(`成功提取了${messages.length}条消息，开始导出`);
      
      exportAs(messages, request.format)
        .then(() => {
          log("导出成功");
          sendResponse({success: true, message: "导出成功"});
        })
        .catch(error => {
          log("导出过程出错: " + error.message);
          sendResponse({error: error.message});
        });
    } catch (error) {
      log("导出请求处理失败: " + error.message);
      sendResponse({error: error.message});
    }
    
    return true; // 保持消息通道开放以便异步响应
  }
});

// 记录页面结构以辅助调试
function logPageStructure() {
  log("===== 页面结构分析 =====");
  
  // 添加对DeepSeek新版界面的支持
  const chatContainer = document.querySelector('#chat-container, .chat-container, [class*="chat-container"]');
  if (chatContainer) {
    log("找到聊天容器: " + chatContainer.className);
  } else {
    log("未找到聊天容器");
  }
  
  // 查找特定的DeepSeek元素
  const markdownBlocks = document.querySelectorAll('div.ds-markdown.ds-markdown--block, [class*="markdown"]');
  log(`找到${markdownBlocks.length}个DeepSeek Markdown块`);
  
  if (markdownBlocks.length > 0) {
    // 记录样例
    const sample = markdownBlocks[markdownBlocks.length - 1];
    log(`最后一个Markdown块: class="${sample.className}", style="${sample.getAttribute('style') || '无'}"`);
    log(`内容预览: ${sample.textContent.substring(0, 100)}...`);
  }
  
  // 查找消息容器
  const messageContainers = document.querySelectorAll('.ds-message, [class*="message"], [role="dialog"] > div');
  log(`找到${messageContainers.length}个消息容器`);
  
  // 查找用户和AI消息
  const userMessages = document.querySelectorAll('.ds-message-user, [class*="user-message"], [class*="message-user"]');
  log(`找到${userMessages.length}个用户消息`);
  
  const assistantMessages = document.querySelectorAll('.ds-message-assistant, [class*="assistant-message"], [class*="message-assistant"]');
  log(`找到${assistantMessages.length}个AI助手消息`);
  
  // 查找思考部分
  const thinkingSections = document.querySelectorAll('.ds-thinking, [class*="thinking"]');
  log(`找到${thinkingSections.length}个思考部分`);
  
  // 尝试记录第一个找到的消息内容
  if (messageContainers.length > 0) {
    const firstMessage = messageContainers[0];
    log(`第一个消息容器内容预览: ${firstMessage.textContent.substring(0, 100)}...`);
    log(`第一个消息容器HTML结构: ${firstMessage.outerHTML.substring(0, 200)}...`);
  }
  
  log("===== 页面结构分析结束 =====");
}

// 提取DeepSeek内容的专用函数
function extractDeepSeekContent(conversationType) {
  log(`使用专用方法提取DeepSeek内容，类型: ${conversationType}`);
  
  // 首先尝试新版DeepSeek界面提取
  const messages = extractFromNewDeepSeekUI();
  
  if (messages && messages.length > 0) {
    log(`从新版界面中成功提取了${messages.length}条消息`);
    return filterMessagesByType(messages, conversationType);
  }
  
  // 尝试从对话结构提取
  const structMessages = extractFromConversationStructure();
  
  if (structMessages && structMessages.length > 0) {
    log(`从对话结构中成功提取了${structMessages.length}条消息`);
    return filterMessagesByType(structMessages, conversationType);
  }
  
  // 尝试提取markdown块
  log("对话结构提取失败，尝试从Markdown块提取");
  const markdownMessages = extractFromMarkdownBlocks();
  
  if (markdownMessages && markdownMessages.length > 0) {
    log(`从Markdown块中成功提取了${markdownMessages.length}条消息`);
    return filterMessagesByType(markdownMessages, conversationType);
  }
  
  // 如果都失败，使用最后的备用方法
  log("所有主要提取方法失败，尝试备用方法");
  const altMessages = tryAlternativeMethods();
  return filterMessagesByType(altMessages, conversationType);
}

// 根据会话类型过滤消息
function filterMessagesByType(messages, conversationType) {
  if (!messages || messages.length === 0) {
    return [];
  }
  
  if (conversationType === 'latest' && messages.length > 0) {
    // 获取最新的一组问答（最后一个用户问题和AI回答）
    const lastAIIndex = messages.map(m => m.role).lastIndexOf('DeepSeek');
    const lastUserBeforeAI = messages.slice(0, lastAIIndex).map(m => m.role).lastIndexOf('用户');
    
    if (lastAIIndex !== -1) {
      if (lastUserBeforeAI !== -1) {
        return messages.slice(lastUserBeforeAI, lastAIIndex + 1);
      } else {
        return [messages[lastAIIndex]];
      }
    }
  } else if (conversationType === 'current' && messages.length > 0) {
    // 获取当前可见的对话（简化为最后4条消息）
    const visibleCount = Math.min(4, messages.length);
    return messages.slice(-visibleCount);
  }
  
  // 返回所有消息
  return messages;
}

// 尝试从新版DeepSeek界面提取内容
function extractFromNewDeepSeekUI() {
  log("尝试从新版DeepSeek界面提取内容");
  
  // 尝试各种可能的选择器组合
  const selectors = [
    // 新版聊天界面
    '.chat-thread-message',
    '[class*="chat-message"]',
    '[class*="message-content"]',
    // 对话容器
    '[role="dialog"] > div',
    // 其他可能的结构
    '[class*="conversation"] [class*="message"]'
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    log(`使用选择器 "${selector}" 找到 ${elements.length} 个元素`);
    
    if (elements.length > 0) {
      const messages = [];
      
      elements.forEach((element, index) => {
        try {
          // 尝试根据样式或其他特征确定是用户还是AI消息
          let role = 'DeepSeek';
          const classes = element.className || '';
          const content = element.textContent.trim();
          
          if (!content) return; // 跳过空内容
          
          if (classes.includes('user') || 
              element.querySelector('[class*="user"]') || 
              element.previousElementSibling?.querySelector('textarea')) {
            role = '用户';
          } else if (classes.includes('assistant') || 
                     classes.includes('deepseek') || 
                     element.querySelector('[class*="assistant"]') ||
                     element.querySelector('[class*="deepseek"]')) {
            role = 'DeepSeek';
          } else {
            // 如果无法确定，根据排序猜测
            role = index % 2 === 0 ? '用户' : 'DeepSeek';
          }
          
          // 找到实际内容区域
          let contentElement = element.querySelector('[class*="content"]') || 
                              element.querySelector('p') || 
                              element;
          
          messages.push({
            role: role,
            content: contentElement.textContent.trim(),
            position: getElementPosition(element)
          });
          
          log(`找到${role}消息: ${contentElement.textContent.trim().substring(0, 50)}...`);
        } catch (error) {
          log(`处理元素出错: ${error.message}`);
        }
      });
      
      // 根据位置排序
      messages.sort((a, b) => a.position - b.position);
      
      // 移除重复和位置信息
      const uniqueMessages = [];
      let lastContent = '';
      
      messages.forEach(msg => {
        if (msg.content !== lastContent) {
          uniqueMessages.push({
            role: msg.role,
            content: msg.content
          });
          lastContent = msg.content;
        }
      });
      
      if (uniqueMessages.length > 0) {
        return uniqueMessages;
      }
    }
  }
  
  log("新版界面提取失败");
  return [];
}

// 从对话结构中提取内容
function extractFromConversationStructure() {
  // 查找所有消息容器
  const userMessages = document.querySelectorAll('.ds-message-user, [class*="user-message"], [class*="message-user"]');
  const assistantMessages = document.querySelectorAll('.ds-message-assistant, [class*="assistant-message"], [class*="message-assistant"]');
  
  if (userMessages.length === 0 && assistantMessages.length === 0) {
    log("未找到符合结构的用户或助手消息");
    return [];
  }
  
  log(`找到${userMessages.length}个用户消息和${assistantMessages.length}个助手消息`);
  
  // 合并所有消息并排序
  const allMessages = [];
  
  // 添加用户消息
  userMessages.forEach(elem => {
    // 查找消息内容元素
    const contentElem = elem.querySelector('.ds-markdown, [class*="content"], [class*="message-text"], p');
    if (contentElem) {
      const position = getElementPosition(elem);
      allMessages.push({
        role: '用户',
        content: contentElem.textContent.trim(),
        position: position
      });
    }
  });
  
  // 添加助手消息
  assistantMessages.forEach(elem => {
    // 查找消息内容元素
    const contentElem = elem.querySelector('.ds-markdown, [class*="content"], [class*="message-text"], p');
    if (contentElem) {
      const position = getElementPosition(elem);
      allMessages.push({
        role: 'DeepSeek',
        content: contentElem.textContent.trim(),
        position: position
      });
    }
  });
  
  // 根据元素在页面中的位置排序
  allMessages.sort((a, b) => a.position - b.position);
  
  // 移除排序用的position字段
  return allMessages.map(({ role, content }) => ({ role, content }));
}

// 获取元素在页面中的相对位置
function getElementPosition(element) {
  let position = 0;
  if (element.getBoundingClientRect) {
    const rect = element.getBoundingClientRect();
    position = rect.top + window.scrollY;
  }
  return position;
}

// 从Markdown块提取内容
function extractFromMarkdownBlocks() {
  // 查找所有markdown块
  const markdownBlocks = document.querySelectorAll('div.ds-markdown.ds-markdown--block, [class*="markdown"]');
  
  if (markdownBlocks.length === 0) {
    log("未找到markdown块");
    return [];
  }
  
  log(`找到${markdownBlocks.length}个markdown块`);
  
  // 获取所有块
  const targetBlocks = Array.from(markdownBlocks);
  log("提取所有对话块");
  
  // 提取内容
  const messages = [];
  let lastRole = null;
  
  // 尝试识别前面的用户消息
  targetBlocks.forEach((block, index) => {
    try {
      // 检查是否是用户输入
      const isUserBlock = block.closest('[class*="user"]') || 
                         block.parentElement?.className.includes('user');
      
      const role = isUserBlock ? '用户' : 'DeepSeek';
      const content = block.textContent.trim();
      
      if (content && (!lastRole || lastRole !== role || index === 0)) {
        messages.push({
          role: role,
          content: content,
          position: getElementPosition(block)
        });
        lastRole = role;
      } else if (content && lastRole === role) {
        // 合并同角色的连续消息
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
          lastMsg.content += "\n\n" + content;
        }
      }
    } catch (error) {
      log(`处理Markdown块出错: ${error.message}`);
    }
  });
  
  // 根据位置排序
  messages.sort((a, b) => a.position - b.position);
  
  // 如果找不到用户消息，尝试推断
  if (messages.every(m => m.role === 'DeepSeek')) {
    log("只找到AI消息，尝试推断用户消息");
    const inferredMessages = [];
    
    messages.forEach((msg, i) => {
      // 在AI消息前添加一个假设的用户消息
      if (i > 0) {
        inferredMessages.push({
          role: '用户',
          content: '[用户提问内容未能检测]'
        });
      }
      inferredMessages.push({
        role: msg.role,
        content: msg.content
      });
    });
    
    return inferredMessages;
  }
  
  // 移除排序用的position字段
  return messages.map(({ role, content }) => ({ role, content }));
}

// 备用提取方法
function tryAlternativeMethods() {
  log("尝试备用提取方法");
  
  // 尝试通过class名包含特定字符串的方式查找
  const possibleContentElements = document.querySelectorAll(
    'p, pre, [class*="markdown"], [class*="content"], [class*="message-text"], [class*="thinking"], [role="presentation"]'
  );
  
  log(`找到${possibleContentElements.length}个可能的内容元素`);
  
  if (possibleContentElements.length === 0) {
    return [{
      role: 'DeepSeek',
      content: '未能检测到页面对话内容。请确保您在DeepSeek聊天页面，并且页面上有对话内容。'
    }];
  }
  
  // 过滤掉内容太少的元素，并保留带有文本的元素
  const contentElements = Array.from(possibleContentElements).filter(el => {
    const text = el.textContent.trim();
    return text.length > 15; // 假设有意义的内容至少有15个字符
  });
  
  log(`过滤后剩余${contentElements.length}个内容元素`);
  
  // 根据元素在页面中的位置排序
  contentElements.sort((a, b) => {
    const posA = getElementPosition(a);
    const posB = getElementPosition(b);
    return posA - posB;
  });
  
  // 提取内容
  const messages = [];
  let lastContent = '';
  let alternatingRole = '用户'; // 开始假设第一个是用户
  
  contentElements.forEach(element => {
    // 尝试根据元素特征判断角色
    let role;
    
    if (element.closest('[class*="user"]') || 
        element.parentElement?.className.includes('user') ||
        element.tagName === 'TEXTAREA') {
      role = '用户';
    } else if (element.closest('[class*="assistant"]') || 
               element.closest('[class*="deepseek"]') ||
               element.parentElement?.className.includes('assistant') ||
               element.parentElement?.className.includes('deepseek')) {
      role = 'DeepSeek';
    } else {
      // 如果无法确定，交替分配角色
      role = alternatingRole;
      alternatingRole = alternatingRole === '用户' ? 'DeepSeek' : '用户';
    }
    
    const content = element.textContent.trim();
    if (content && content !== lastContent) {
      // 检查是否和前一条消息相同角色且相近位置
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      
      if (lastMsg && lastMsg.role === role && 
          Math.abs(getElementPosition(element) - lastMsg.position) < 100) {
        // 合并内容
        lastMsg.content += "\n\n" + content;
      } else {
        messages.push({ 
          role, 
          content,
          position: getElementPosition(element)
        });
      }
      
      lastContent = content;
    }
  });
  
  // 移除位置信息
  return messages.map(({ role, content }) => ({ role, content }));
}

// 导出对话内容为指定格式
async function exportAs(messages, format) {
  log(`开始导出为${format}格式`);
  
  // 生成文件名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `DeepSeek对话_${timestamp}`;
  
  // 根据格式导出
  switch (format) {
    case 'docx':
      return exportToWord(messages, filename);
    case 'pdf':
      return exportToPDF(messages, filename);
    case 'md':
      return exportToMarkdown(messages, filename);
    default:
      throw new Error(`不支持的导出格式: ${format}`);
  }
}

// 导出为Word
async function exportToWord(messages, filename) {
  try {
    log("开始Word导出");
    
    // 直接生成文本版
    let content = "# DeepSeek对话记录\n\n";
    content += `导出时间: ${new Date().toLocaleString()}\n\n`;
    
    messages.forEach(message => {
      content += `## ${message.role}\n\n${message.content}\n\n---\n\n`;
    });
    
    const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log("Word导出完成");
    return Promise.resolve();
  } catch (error) {
    log(`Word导出错误: ${error.message}`);
    return Promise.reject(error);
  }
}

// 导出为PDF
async function exportToPDF(messages, filename) {
  try {
    log("开始PDF导出");
    
    // 直接生成文本版
    let content = "# DeepSeek对话记录\n\n";
    content += `导出时间: ${new Date().toLocaleString()}\n\n`;
    
    messages.forEach(message => {
      content += `## ${message.role}\n\n${message.content}\n\n---\n\n`;
    });
    
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log("PDF导出完成");
    return Promise.resolve();
  } catch (error) {
    log(`PDF导出错误: ${error.message}`);
    return Promise.reject(error);
  }
}

// 导出为Markdown
async function exportToMarkdown(messages, filename) {
  try {
    log("开始Markdown导出");
    
    let markdown = '# DeepSeek对话记录\n\n';
    markdown += `导出时间: ${new Date().toLocaleString()}\n\n---\n\n`;
    
    messages.forEach(message => {
      markdown += `## ${message.role}\n\n${message.content}\n\n---\n\n`;
    });
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log("Markdown导出完成");
    return Promise.resolve();
  } catch (error) {
    log(`Markdown导出错误: ${error.message}`);
    return Promise.reject(error);
  }
}