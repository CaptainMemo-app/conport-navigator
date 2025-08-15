// Simple version without CodeMirror imports - works immediately
const API_BASE = 'http://localhost:3456';

// State
let currentProjects = [];
let activeProjectId = null;
let currentType = null;
let currentItems = [];
let currentItem = null;

// Load projects from server
async function loadProjects() {
  console.log('Loading projects...');
  try {
    const response = await fetch(`${API_BASE}/projects`);
    const data = await response.json();
    
    console.log('Projects loaded:', data);
    currentProjects = data.projects || [];
    activeProjectId = data.activeProjectId;
    
    // Update project selector
    const select = document.getElementById('project-select');
    if (!select) {
      console.error('Project select element not found');
      return;
    }
    
    select.innerHTML = '';
    
    if (currentProjects.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No projects - Add one first';
      select.appendChild(option);
      console.log('No projects found');
    } else {
      console.log(`Found ${currentProjects.length} projects`);
      currentProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = `${project.connected ? '🟢' : '🔴'} ${project.name}`;
        
        if (project.active || project.id === activeProjectId) {
          option.selected = true;
          updateProjectDisplay(project);
        }
        
        select.appendChild(option);
        console.log(`Added project: ${project.name} (${project.path})`);
      });
    }
    
    // Update connection status
    const activeProject = currentProjects.find(p => p.id === activeProjectId);
    updateConnectionStatus(activeProject?.connected);
    
  } catch (error) {
    console.error('Failed to load projects:', error);
  }
}

// Update project display
function updateProjectDisplay(project) {
  console.log('Updating project display:', project);
  const pathDisplay = document.getElementById('project-path-display');
  if (pathDisplay) {
    pathDisplay.textContent = project ? project.path : 'No project selected';
    pathDisplay.title = project ? project.path : '';
  }
  
  // Update stats if available
  if (project && project.counts) {
    const decisionsStat = document.getElementById('stat-decisions');
    const progressStat = document.getElementById('stat-progress');
    const customStat = document.getElementById('stat-custom');
    
    if (decisionsStat) decisionsStat.textContent = project.counts.decisions || 0;
    if (progressStat) progressStat.textContent = project.counts.progress || 0;
    if (customStat) customStat.textContent = project.counts.customData || 0;
  }
  
  if (project && project.stats) {
    const queriesStat = document.getElementById('stat-queries');
    if (queriesStat) queriesStat.textContent = project.stats.queries || 0;
  }
}

// Update connection status
function updateConnectionStatus(connected) {
  const status = document.getElementById('connection-status');
  if (!status) return;
  
  if (connected) {
    status.textContent = 'Connected';
    status.className = '';
    status.style.background = '#27ae60';
  } else {
    status.textContent = 'Disconnected';
    status.className = 'error';
    status.style.background = '#e74c3c';
  }
}

// Switch active project
async function switchProject(projectId) {
  console.log('Switching to project:', projectId);
  try {
    const response = await fetch(`${API_BASE}/projects/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId })
    });
    
    if (response.ok) {
      activeProjectId = projectId;
      const project = currentProjects.find(p => p.id === projectId);
      updateProjectDisplay(project);
      console.log('Switched to project:', project?.name);
      
      // Reload data counts
      await loadDataCounts();
    }
  } catch (error) {
    console.error('Failed to switch project:', error);
  }
}

// ConPort API Functions
async function conport(method, params = {}, projectId = null) {
  try {
    const response = await fetch(`${API_BASE}/conport`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method,
        params,
        projectId: projectId || activeProjectId
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('ConPort error:', error);
    showStatus('Error: ' + error.message, 'error');
    return null;
  }
}

// Load data counts for sidebar
async function loadDataCounts() {
  console.log('Loading data counts...');
  
  if (!activeProjectId) {
    console.log('No active project, skipping data counts');
    return;
  }
  
  try {
    // Load counts for each data type
    const types = [
      { key: 'product_context', method: 'get_product_context' },
      { key: 'active_context', method: 'get_active_context' },
      { key: 'decisions', method: 'get_decisions' },
      { key: 'progress', method: 'get_progress' },
      { key: 'system_patterns', method: 'get_system_patterns' },
      { key: 'custom_data', method: 'get_custom_data' }
    ];
    
    for (const type of types) {
      try {
        const data = await conport(type.method, { limit: 100 });
        let count = 0;
        
        if (data) {
          if (Array.isArray(data)) {
            count = data.length;
          } else if (data.content || data.id) {
            count = 1; // Context data
          }
        }
        
        const countEl = document.getElementById(`count-${type.key}`);
        if (countEl) {
          countEl.textContent = count;
        }
        
        console.log(`${type.key}: ${count} items`);
      } catch (error) {
        console.error(`Failed to load ${type.key}:`, error);
        const countEl = document.getElementById(`count-${type.key}`);
        if (countEl) {
          countEl.textContent = '?';
        }
      }
    }
  } catch (error) {
    console.error('Failed to load data counts:', error);
  }
}

// Show status messages
function showStatus(message, type = 'info') {
  console.log(`[${type}] ${message}`);
  const statusEl = document.getElementById('status-message');
  if (!statusEl) return;
  
  statusEl.textContent = message;
  statusEl.className = `status-message show ${type}`;
  
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 3000);
}

// Data Loading Functions
async function loadDataType(type) {
  if (!type) return;
  
  console.log(`Loading data type: ${type}`);
  currentType = type;
  currentItems = [];
  currentItem = null;
  
  // Update UI
  document.querySelectorAll('.data-type').forEach(el => {
    el.classList.toggle('active', el.dataset.type === type);
  });
  
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.classList.add('show');
  
  try {
    let data;
    switch(type) {
      case 'product_context':
        data = await conport('get_product_context');
        currentItems = data ? [data] : [];
        break;
      case 'active_context':
        data = await conport('get_active_context');
        currentItems = data ? [data] : [];
        break;
      case 'decisions':
        data = await conport('get_decisions', { limit: 100 });
        currentItems = Array.isArray(data) ? data : [];
        break;
      case 'progress':
        data = await conport('get_progress', { limit: 100 });
        currentItems = Array.isArray(data) ? data : [];
        break;
      case 'system_patterns':
        data = await conport('get_system_patterns', { limit: 100 });
        currentItems = Array.isArray(data) ? data : [];
        break;
      case 'custom_data':
        data = await conport('get_custom_data');
        currentItems = Array.isArray(data) ? data : [];
        break;
    }
    
    console.log(`Loaded ${currentItems.length} items for ${type}:`, currentItems);
    
    // Update tree content
    updateTreeContent();
    
    if (currentItems.length > 0) {
      showStatus(`Loaded ${currentItems.length} ${formatTypeName(type).toLowerCase()}`, 'success');
    } else {
      showStatus(`No ${formatTypeName(type).toLowerCase()} found`, 'warning');
    }
  } catch (error) {
    console.error(`Failed to load ${type}:`, error);
    showStatus(`Failed to load ${type}: ${error.message}`, 'error');
  } finally {
    if (loadingEl) loadingEl.classList.remove('show');
  }
}

// Update tree content with loaded data
function updateTreeContent() {
  const container = document.getElementById('tree-content');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (currentItems.length === 0) {
    container.innerHTML = '<div class="empty-state">No items found</div>';
    return;
  }
  
  currentItems.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'list-item';
    itemEl.dataset.index = index;
    
    const title = document.createElement('div');
    title.className = 'list-item-title';
    title.textContent = getItemTitle(item);
    
    const meta = document.createElement('div');
    meta.className = 'list-item-meta';
    meta.textContent = getItemMeta(item);
    
    itemEl.appendChild(title);
    if (meta.textContent) {
      itemEl.appendChild(meta);
    }
    
    itemEl.addEventListener('click', () => {
      document.querySelectorAll('.list-item').forEach(el => el.classList.remove('active'));
      itemEl.classList.add('active');
      loadDataInEditor(item);
    });
    
    container.appendChild(itemEl);
  });
  
  // Load first item in editor
  if (currentItems.length > 0) {
    const firstItem = container.querySelector('.list-item');
    if (firstItem) {
      firstItem.classList.add('active');
      loadDataInEditor(currentItems[0]);
    }
  }
}

// Load data in editor with enhanced formatting
function loadDataInEditor(item) {
    console.log('Loading in editor:', item);
    currentItem = item;

    let content = '';
    let language = 'json';

    if (item && typeof item === 'object') {
        // Handle context data specially
        if (item.content && (currentType === 'product_context' || currentType === 'active_context')) {
            try {
                const parsed = JSON.parse(item.content);
                content = JSON.stringify(parsed, null, 2);
                language = 'json';
            } catch {
                content = item.content;
                language = 'text';
            }
        } else {
            content = JSON.stringify(item, null, 2);
            language = 'json';
        }
    }

    rawItemContent = content || '{}';

    const editorContainer = document.getElementById('codemirror-editor');
    if (window.createEnhancedJSONEditor) {
        const view = window.createEnhancedJSONEditor(editorContainer, rawItemContent);
        setEditorMode(editorMode, view);
    }

    // Update editor info
    const editorPath = document.getElementById('editor-path');
    const editorType = document.getElementById('editor-type');
    const editorLines = document.getElementById('editor-lines');
    const editorSize = document.getElementById('editor-size');

    if (editorPath) editorPath.textContent = getItemTitle(item) || 'No data selected';
    if (editorType) editorType.textContent = `Type: ${language.toUpperCase()}`;

    if (content) {
        const lines = content.split('\n').length;
        const size = new Blob([content]).size;

        if (editorLines) editorLines.textContent = `Lines: ${lines}`;
        if (editorSize) editorSize.textContent = `Size: ${formatBytes(size)}`;
    }
}

// HTML escape utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Utility functions
function formatTypeName(type) {
  if (!type) return '';
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function getItemTitle(item) {
  if (!item) return 'Untitled';
  if (item.summary) return item.summary;
  if (item.description) return item.description;
  if (item.name) return item.name;
  if (item.key) return item.key;
  if (item.title) return item.title;
  if (item.content && typeof item.content === 'string') {
    return item.content.substring(0, 50) + (item.content.length > 50 ? '...' : '');
  }
  if (currentType === 'product_context') return 'Product Context';
  if (currentType === 'active_context') return 'Active Context';
  return 'Untitled';
}

function getItemMeta(item) {
  if (!item) return '';
  const meta = [];
  
  if (item.status) meta.push(`Status: ${item.status}`);
  if (item.category) meta.push(`Category: ${item.category}`);
  if (item.tags) {
    const tags = typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags;
    if (Array.isArray(tags) && tags.length > 0) {
      meta.push(`Tags: ${tags.join(', ')}`);
    }
  }
  if (item.timestamp) {
    const date = new Date(item.timestamp);
    meta.push(date.toLocaleDateString());
  }
  if (item.id) meta.push(`ID: ${item.id}`);
  
  return meta.join(' • ');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Toolbar Functions
function formatJSON() {
    const view = window.getEditorView();
    if (!view) return;

    try {
        const content = view.state.doc.toString();
        const parsed = JSON.parse(content);
        const formatted = JSON.stringify(parsed, null, 2);

        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: formatted }
        });
        showStatus('JSON formatted successfully', 'success');
    } catch (error) {
        showStatus('Invalid JSON, cannot format', 'error');
    }
}

function copyContent() {
    const content = getEditorContent();
    if (content) {
        navigator.clipboard.writeText(content).then(() => {
            showStatus('Content copied to clipboard', 'success');
        }, () => {
            showStatus('Failed to copy content', 'error');
        });
    }
}

let editorMode = 'preview'; // 'edit', 'preview', 'raw'
let rawItemContent = null; // Store raw content for editing

// Save content back to ConPort
async function saveContent() {
  console.log('Save content clicked');
  
  if (!currentItem || !activeProjectId) {
    showStatus('No item selected or no active project', 'error');
    return;
  }
  
  const editorContainer = document.getElementById('codemirror-editor');
  if (!editorContainer) return;
  
  try {
    // Get current content from editor
    let content = getEditorContent();
    if (!content) {
      showStatus('No content to save', 'warning');
      return;
    }
    
    // Parse content to validate JSON
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      showStatus('Invalid JSON: ' + e.message, 'error');
      return;
    }
    
    // Determine save method based on current data type
    let saveResult;
    switch(currentType) {
      case 'product_context':
        saveResult = await conport('update_product_context', { content: parsedContent });
        break;
      case 'active_context':
        saveResult = await conport('update_active_context', { content: parsedContent });
        break;
      case 'custom_data':
        if (parsedContent.category && parsedContent.key) {
          saveResult = await conport('log_custom_data', {
            category: parsedContent.category,
            key: parsedContent.key,
            value: parsedContent.value || parsedContent
          });
        } else {
          throw new Error('Custom data requires category and key');
        }
        break;
      default:
        throw new Error('Saving not yet supported for ' + currentType);
    }
    
    if (saveResult) {
      showStatus('Content saved successfully', 'success');
      // Reload the data to reflect changes
      await loadDataType(currentType);
    } else {
      throw new Error('Save operation returned no result');
    }
    
  } catch (error) {
    console.error('Save failed:', error);
    showStatus('Save failed: ' + error.message, 'error');
  }
}

// Get content from editor
function getEditorContent() {
    const view = window.getEditorView();
    if (view) {
        return view.state.doc.toString();
    }
    return null;
}

// Set editor mode
function setEditorMode(mode, view) {
    editorMode = mode;
    view = view || window.getEditorView();

    if (!view) return;

    // Update view tab states
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === mode);
    });

    let isReadOnly = mode === 'preview' || mode === 'raw';

    view.dispatch({
        effects: EditorView.editable.reconfigure(EditorState.readOnly.of(isReadOnly))
    });

    if (mode === 'raw') {
        // In raw mode, we might want to disable syntax highlighting or use a plain text mode.
        // For now, it's just read-only.
    }

    showStatus(`Switched to ${mode} mode`, 'info');
}

// Fold/unfold functions removed - buttons removed from UI


// Add Project Modal Functions
function openAddProjectModal() {
  console.log('Opening Add Project modal...');
  const modal = document.getElementById('add-project-modal');
  if (!modal) {
    console.error('Modal not found!');
    return;
  }
  
  modal.classList.add('show');
  
  // Reset form
  const pathInput = document.getElementById('new-project-path');
  const nameInput = document.getElementById('new-project-name');
  const statusEl = document.getElementById('path-validation-status');
  const confirmBtn = document.getElementById('add-project-confirm');
  
  if (pathInput) pathInput.value = '';
  if (nameInput) nameInput.value = '';
  if (statusEl) statusEl.className = 'validation-status';
  if (confirmBtn) confirmBtn.disabled = false; // Enable for testing
}

function closeAddProjectModal() {
  const modal = document.getElementById('add-project-modal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Browse button handler with modern directory picker support
async function browseForFolder() {
  console.log('Browse button clicked');
  
  try {
    // Try using the modern File System Access API first
    if ('showDirectoryPicker' in window) {
      console.log('Using File System Access API');
      try {
        const directoryHandle = await window.showDirectoryPicker({
          mode: 'read'
        });
        
        // Get the full path if possible
        let path = directoryHandle.name;
        
        // Try to get full path - this might not work on all browsers
        if (directoryHandle.resolve) {
          try {
            const pathArray = await directoryHandle.resolve();
            if (pathArray && pathArray.length > 0) {
              path = '/' + pathArray.join('/');
            }
          } catch (e) {
            console.log('Could not resolve full path, using directory name');
          }
        }
        
        // If we only got the directory name, ask user to provide full path
        if (!path.startsWith('/') && !path.startsWith('.') && !path.includes('/')) {
          const fullPath = prompt(
            `Selected directory: "${path}"\n\nPlease provide the full absolute path to this directory:`,
            `/path/to/${path}`
          );
          if (fullPath) {
            path = fullPath;
          }
        }
        
        const pathInput = document.getElementById('new-project-path');
        if (pathInput) {
          pathInput.value = path;
          validatePath();
        }
        
        return;
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Directory picker was cancelled');
          return;
        }
        console.log('File System Access API failed, falling back to prompt:', error);
      }
    }
    
    // Fallback to prompt-based path selection
    console.log('Using prompt fallback');
    const currentPath = window.location.pathname.includes('spec-driven-memory-bank-app') 
      ? '/Users/pps/Documents/DEV/LAB/spec-driven-memory-bank-app'
      : '.';
    
    const message = `Enter the absolute path to your ConPort project folder:

Example paths:
• /Users/pps/Documents/DEV/LAB/spec-driven-memory-bank-app
• /Users/pps/Documents/YOUR_PROJECT
• /path/to/your/project

The folder should contain a ConPort database (context_portal/context.db)`;
    
    const path = prompt(message, currentPath);
    
    if (path) {
      const pathInput = document.getElementById('new-project-path');
      if (pathInput) {
        pathInput.value = path;
        validatePath();
      }
    }
    
  } catch (error) {
    console.error('Browse folder failed:', error);
    alert('Failed to open directory picker. Please enter the path manually.');
  }
}

// Path validation
let validationTimeout = null;

function validatePath() {
  if (validationTimeout) {
    clearTimeout(validationTimeout);
  }
  
  validationTimeout = setTimeout(async () => {
    await doValidatePath();
  }, 500);
}

async function doValidatePath() {
  const pathInput = document.getElementById('new-project-path');
  const statusEl = document.getElementById('path-validation-status');
  const confirmBtn = document.getElementById('add-project-confirm');
  const path = pathInput.value.trim();
  
  if (!path) {
    statusEl.className = 'validation-status';
    confirmBtn.disabled = true;
    return;
  }
  
  statusEl.className = 'validation-status checking show';
  statusEl.textContent = 'Checking path...';
  
  // For now, just check if it looks like a valid path
  const isValid = path.startsWith('/') || path.startsWith('.') || path.startsWith('~');
  
  if (isValid) {
    statusEl.className = 'validation-status valid show';
    statusEl.textContent = '✓ Path looks valid';
    confirmBtn.disabled = false;
    
    // Auto-fill project name
    const nameInput = document.getElementById('new-project-name');
    if (!nameInput.value) {
      nameInput.value = path.split('/').pop() || 'ConPort Project';
    }
  } else {
    statusEl.className = 'validation-status invalid show';
    statusEl.textContent = '✗ Please enter a valid path';
    confirmBtn.disabled = true;
  }
}

async function addNewProject() {
  const path = document.getElementById('new-project-path').value.trim();
  const name = document.getElementById('new-project-name').value.trim() || path.split('/').pop();
  
  if (!path) {
    alert('Please enter a project path');
    return;
  }
  
  console.log(`Adding project: ${name} at ${path}`);
  
  try {
    const response = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name, 
        path,
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      })
    });
    
    if (response.ok) {
      const newProject = await response.json();
      console.log('Project added successfully:', newProject);
      
      closeAddProjectModal();
      
      // Don't reload page - just refresh the project list
      await loadProjects();
      
      // Switch to the new project
      if (newProject.id) {
        await switchProject(newProject.id);
      }
      
      // Show success message
      const statusEl = document.getElementById('status-message');
      if (statusEl) {
        statusEl.textContent = `Project '${name}' added successfully!`;
        statusEl.className = 'status-message show success';
        setTimeout(() => {
          statusEl.classList.remove('show');
        }, 3000);
      } else {
        alert(`Project '${name}' added successfully!`);
      }
    } else {
      const errorData = await response.json();
      console.error('Failed to add project:', errorData);
      alert(`Failed to add project: ${errorData.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Failed to add project:', error);
    alert(`Failed to add project: ${error.message}`);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Simple app initializing...');
  
  // Set up event handlers for modal
  const pathInput = document.getElementById('new-project-path');
  if (pathInput) {
    pathInput.addEventListener('input', validatePath);
  }
  
  const browseBtn = document.getElementById('browse-button');
  if (browseBtn) {
    browseBtn.addEventListener('click', browseForFolder);
  }
  
  const cancelBtn = document.getElementById('cancel-project-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeAddProjectModal);
  }
  
  const confirmBtn = document.getElementById('add-project-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', addNewProject);
  }
  
  // Project selector change handler
  const projectSelect = document.getElementById('project-select');
  if (projectSelect) {
    projectSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        switchProject(e.target.value);
      }
    });
  }
  
  // Modal close on outside click
  const modal = document.getElementById('add-project-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeAddProjectModal();
      }
    });
  }
  
  // Data type navigation handlers
  document.querySelectorAll('.data-type').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      console.log(`Data type clicked: ${type}`);
      loadDataType(type);
    });
  });
  
  // Toolbar button handlers
  document.getElementById('btn-format')?.addEventListener('click', formatJSON);
  document.getElementById('btn-copy')?.addEventListener('click', copyContent);
  document.getElementById('btn-save')?.addEventListener('click', saveContent);

  // View tabs are different - they use data-view attribute
  document.querySelectorAll('.view-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
          const mode = e.target.dataset.view;
          setEditorMode(mode);
      });
  });
  
  console.log('Event handlers set up, loading projects...');
  
  // Load projects on initialization
  try {
    // Test server connection first
    console.log('Testing server connection...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const health = await healthResponse.json();
    console.log('Server health:', health);
    
    await loadProjects();
    await loadDataCounts();
    console.log('Simple app ready!');
    
    // Show initialization status
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = 'ConPort Navigator ready! Click a data type to explore.';
      statusEl.className = 'status-message show success';
      setTimeout(() => {
        statusEl.classList.remove('show');
      }, 3000);
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
    
    // Show error status
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = `Initialization failed: ${error.message}`;
      statusEl.className = 'status-message show error';
      setTimeout(() => {
        statusEl.classList.remove('show');
      }, 5000);
    }
  }
});

// Export functions globally
window.openAddProjectModal = openAddProjectModal;
window.closeAddProjectModal = closeAddProjectModal;
window.browseForFolder = browseForFolder;
window.validatePath = validatePath;
window.addNewProject = addNewProject;
window.loadDataType = loadDataType;
window.showStatus = showStatus;
window.conport = conport;
window.formatJSON = formatJSON;
window.copyContent = copyContent;
window.toggleSearch = toggleSearch;
window.saveContent = saveContent;
window.setEditorMode = setEditorMode;
window.undoAction = undoAction;
window.redoAction = redoAction;
window.saveToHistory = saveToHistory;