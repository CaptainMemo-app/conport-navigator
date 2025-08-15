// CodeMirror 6 Integration - Using bundle approach
// This loads CodeMirror from a reliable CDN bundle

let editorView = null;

// Load CodeMirror from CDN bundle
const CODEMIRROR_CDN = 'https://unpkg.com/codemirror@6.0.1/dist/index.js';

// Load CodeMirror bundle
async function loadCodeMirror() {
  try {
    console.log('Loading CodeMirror...');
    
    // Use the bundle approach
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/codemirror@6.0.1/dist/index.js';
    script.type = 'module';
    
    return new Promise((resolve, reject) => {
      script.onload = () => {
        console.log('CodeMirror loaded successfully');
        resolve();
      };
      script.onerror = () => {
        console.error('Failed to load CodeMirror');
        reject(new Error('CodeMirror failed to load'));
      };
      document.head.appendChild(script);
    });
  } catch (error) {
    console.error('Error loading CodeMirror:', error);
    throw error;
  }
}

// Enhanced editor with syntax highlighting
function createCodeMirrorEditor(container, content = '', language = 'json') {
  try {
    // Clear existing content
    container.innerHTML = '';
    
    const preEl = document.createElement('pre');
    preEl.style.cssText = `
      padding: 20px; 
      background: #f8f9fa; 
      height: 100%; 
      overflow: auto; 
      margin: 0; 
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; 
      font-size: 14px;
      line-height: 1.6;
      border: none;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: #333;
      position: relative;
    `;
    
    // Apply syntax highlighting based on language
    let highlightedContent;
    switch (language) {
      case 'yaml':
        highlightedContent = highlightYAML(content);
        break;
      case 'markdown':
        highlightedContent = highlightMarkdown(content);
        break;
      case 'json':
      default:
        highlightedContent = highlightJSON(content);
        break;
    }
    
    // Add line numbers
    const lines = highlightedContent.split('\n');
    const numberedContent = lines.map((line, index) => {
      const lineNum = (index + 1).toString().padStart(3, ' ');
      return `<span style="color: #999; margin-right: 10px; user-select: none; display: inline-block; width: 40px;">${lineNum}</span>${line}`;
    }).join('\n');
    
    preEl.innerHTML = numberedContent;
    container.appendChild(preEl);
    
    // Add interactive features
    if (language === 'json') {
      addJSONFoldingFeatures(preEl);
    }
    
    console.log(`Enhanced ${language} editor created with syntax highlighting`);
    return preEl;
  } catch (error) {
    console.error('Failed to create enhanced editor:', error);
    // Fallback to simple text
    container.innerHTML = `<pre style="padding: 20px; font-family: monospace;">${escapeHtml(content)}</pre>`;
    return null;
  }
}

// Enhanced JSON formatting with syntax highlighting and nested JSON support
function createEnhancedJSONEditor(container, jsonContent) {
  try {
    container.innerHTML = '';
    
    // Parse and format JSON with nested JSON handling
    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
      
      // Handle ConPort data with stringified JSON in value fields
      if (parsed && typeof parsed === 'object') {
        parsed = expandNestedJSON(parsed);
      }
      
      jsonContent = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // Not valid JSON, show as-is
    }
    
    const preEl = document.createElement('pre');
    preEl.style.cssText = `
      padding: 20px; 
      background: #f8f9fa; 
      height: 100%; 
      overflow: auto; 
      margin: 0; 
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; 
      font-size: 14px;
      line-height: 1.6;
      border: none;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: #333;
    `;
    
    // Add enhanced JSON syntax highlighting
    const highlighted = highlightJSON(jsonContent);
    preEl.innerHTML = highlighted;
    
    container.appendChild(preEl);
    
    // Add click-to-fold functionality
    addJSONFoldingFeatures(preEl);
    
    return preEl;
  } catch (error) {
    console.error('Failed to create enhanced JSON editor:', error);
    container.innerHTML = `<pre style="padding: 20px; font-family: monospace;">${escapeHtml(jsonContent)}</pre>`;
    return null;
  }
}

// Recursively expand nested JSON strings in ConPort data
function expandNestedJSON(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => expandNestedJSON(item));
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Check if this looks like stringified JSON
      if ((key === 'value' || key === 'content') && 
          (value.startsWith('{') || value.startsWith('['))) {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(value);
          result[key] = expandNestedJSON(parsed);
          continue;
        } catch (e) {
          // If parsing fails, try to handle escaped newlines
          if (value.includes('\\n')) {
            try {
              // Unescape newlines and try again
              const unescaped = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
              const parsed = JSON.parse(unescaped);
              result[key] = expandNestedJSON(parsed);
              continue;
            } catch (e2) {
              // Still failed, keep as string but format newlines
              result[key] = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
              continue;
            }
          }
        }
      }
      result[key] = value;
    } else {
      result[key] = expandNestedJSON(value);
    }
  }
  
  return result;
}

// Enhanced JSON syntax highlighting
function highlightJSON(json) {
  // Escape HTML first
  let escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  return escaped
    // Keys (property names)
    .replace(/("([^"\\]|\\.)*")\s*:/g, '<span style="color: #d73a49; font-weight: bold;">$1</span>:')
    // String values
    .replace(/:\s*("([^"\\]|\\.)*")/g, ': <span style="color: #032f62;">$1</span>')
    // Numbers
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span style="color: #005cc5;">$1</span>')
    // Booleans and null
    .replace(/:\s*(true|false|null)/g, ': <span style="color: #e36209; font-weight: bold;">$1</span>')
    // Braces
    .replace(/([{}])/g, '<span style="color: #6f42c1; font-weight: bold;">$1</span>')
    // Brackets
    .replace(/([[\]])/g, '<span style="color: #22863a; font-weight: bold;">$1</span>')
    // Commas
    .replace(/(,)/g, '<span style="color: #6a737d;">$1</span>')
    // Array string values
    .replace(/\[\s*("([^"\\]|\\.)*")/g, '[<span style="color: #032f62;">$1</span>')
    .replace(/,\s*("([^"\\]|\\.)*")/g, ', <span style="color: #032f62;">$1</span>');
}

// YAML syntax highlighting
function highlightYAML(yaml) {
  return yaml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Keys
    .replace(/^(\s*)([^:\n]+):/gm, '$1<span style="color: #d73a49; font-weight: bold;">$2</span>:')
    // Comments
    .replace(/(#.*$)/gm, '<span style="color: #6a737d; font-style: italic;">$1</span>')
    // Strings
    .replace(/:\s*("([^"\\]|\\.)*")/g, ': <span style="color: #032f62;">$1</span>')
    .replace(/:\s*('([^'\\]|\\.)*')/g, ': <span style="color: #032f62;">$1</span>')
    // Numbers
    .replace(/:\s*(-?\d+\.?\d*)/g, ': <span style="color: #005cc5;">$1</span>')
    // Booleans
    .replace(/:\s*(true|false|null|yes|no)/gi, ': <span style="color: #e36209; font-weight: bold;">$1</span>')
    // List indicators
    .replace(/^(\s*)-\s/gm, '$1<span style="color: #22863a; font-weight: bold;">- </span>');
}

// Markdown syntax highlighting
function highlightMarkdown(markdown) {
  return markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^(#{1,6})\s+(.+)$/gm, '<span style="color: #6f42c1; font-weight: bold;">$1</span> <span style="color: #d73a49; font-weight: bold;">$2</span>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<span style="font-weight: bold;">**$1**</span>')
    // Italic
    .replace(/\*(.*?)\*/g, '<span style="font-style: italic;">*$1*</span>')
    // Code blocks
    .replace(/```([^`]+)```/g, '<span style="background: #f6f8fa; color: #032f62; padding: 2px 4px;">```$1```</span>')
    // Inline code
    .replace(/`([^`]+)`/g, '<span style="background: #f6f8fa; color: #032f62; padding: 2px 4px;">$1</span>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span style="color: #0366d6;">[<span style="text-decoration: underline;">$1</span>]($2)</span>')
    // Lists
    .replace(/^(\s*[-*+])\s/gm, '$1<span style="color: #22863a; font-weight: bold;">$1 </span>');
}

// Add folding features to JSON
function addJSONFoldingFeatures(element) {
  // Add collapsible sections for objects and arrays
  const content = element.innerHTML;
  
  // Add expand/collapse buttons for objects and arrays
  element.addEventListener('click', (e) => {
    if (e.target.textContent === '{' || e.target.textContent === '[') {
      // Simple toggle logic - this could be enhanced
      const parent = e.target.parentNode;
      if (parent.classList.contains('collapsed')) {
        parent.classList.remove('collapsed');
      } else {
        parent.classList.add('collapsed');
      }
    }
  });
}

// Escape HTML for safe display
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Detect content language
function detectLanguage(content, filename = '') {
  if (filename.endsWith('.yml') || filename.endsWith('.yaml')) return 'yaml';
  if (filename.endsWith('.md') || filename.endsWith('.markdown')) return 'markdown';
  if (filename.endsWith('.json')) return 'json';
  
  if (typeof content === 'string') {
    if (content.includes('#') || content.includes('```') || content.includes('**')) {
      return 'markdown';
    }
    if (content.includes('---') || content.match(/^-\s+/m) || content.match(/^\s*\w+:\s+/m)) {
      return 'yaml';
    }
    try {
      JSON.parse(content);
      return 'json';
    } catch (e) {
      // Not JSON
    }
  }
  
  return 'text';
}

// Enhanced editor with search
function addSearchFeature(container) {
  const searchBox = document.createElement('div');
  searchBox.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 10;
    display: none;
  `;
  searchBox.innerHTML = `
    <input type="text" placeholder="Search..." style="
      padding: 5px 8px;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 12px;
      width: 150px;
    ">
    <button onclick="this.parentNode.style.display='none'" style="
      margin-left: 5px;
      padding: 5px 8px;
      border: none;
      background: #f0f0f0;
      border-radius: 3px;
      cursor: pointer;
    ">×</button>
  `;
  
  container.style.position = 'relative';
  container.appendChild(searchBox);
  
  // Add search functionality
  const searchInput = searchBox.querySelector('input');
  searchInput.addEventListener('input', (e) => {
    highlightSearchResults(container, e.target.value);
  });
  
  return {
    show: () => {
      searchBox.style.display = 'block';
      searchInput.focus();
    },
    hide: () => {
      searchBox.style.display = 'none';
      clearSearchHighlights(container);
    }
  };
}

function highlightSearchResults(container, query) {
  // Simple search highlighting
  if (!query) {
    clearSearchHighlights(container);
    return;
  }
  
  const pre = container.querySelector('pre');
  if (!pre) return;
  
  let content = pre.textContent;
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  const highlighted = content.replace(regex, '<mark style="background: yellow; padding: 1px 2px;">$1</mark>');
  
  // This is a simplified approach - in a real implementation you'd preserve existing HTML
  if (query.length > 2) { // Only highlight for longer queries
    pre.innerHTML = highlighted;
  }
}

function clearSearchHighlights(container) {
  const marks = container.querySelectorAll('mark');
  marks.forEach(mark => {
    mark.outerHTML = mark.textContent;
  });
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Export functions
window.createCodeMirrorEditor = createCodeMirrorEditor;
window.createEnhancedJSONEditor = createEnhancedJSONEditor;
window.expandNestedJSON = expandNestedJSON;
window.detectLanguage = detectLanguage;
window.loadCodeMirror = loadCodeMirror;
window.addSearchFeature = addSearchFeature;
window.highlightJSON = highlightJSON;
window.highlightYAML = highlightYAML;
window.highlightMarkdown = highlightMarkdown;
window.escapeHtml = escapeHtml;