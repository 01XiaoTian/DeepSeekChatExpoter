const formatters = {
  json: (data) => JSON.stringify(data, null, 2),
  
  markdown: (data) => {
    return data.messages.map(msg => {
      return `### ${msg.role.toUpperCase()} [${msg.timestamp}]\n\n${msg.content}\n\n---\n`;
    }).join('\n');
  },
  
  txt: (data) => {
    return data.messages.map(msg => {
      return `[${msg.timestamp}] ${msg.role}: ${msg.content}`;
    }).join('\n\n');
  }
};

function formatExport(data, format) {
  const formatter = formatters[format] || formatters.json;
  return formatter(data);
}

function downloadFile(content, format) {
  const blob = new Blob([new TextEncoder().encode(content)], { 
    type: format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8' 
  });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(/[\/\s:]/g, '-');
  
  const filename = `deepseek-chat-${timestamp}.${format}`;
  
  chrome.downloads.download({
    url: url,
    filename: filename
  });
}
