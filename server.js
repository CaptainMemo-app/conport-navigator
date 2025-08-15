const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');
const chokidar = require('chokidar');

const app = express();
const PORT = 3456;

// CORS headers - apply first
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Body parser middleware
app.use(express.json());

// Explicit route for root - BEFORE static files
app.get('/', (req, res) => {
  console.log('Root route hit');
  const indexPath = path.join(__dirname, 'index.html');
  console.log('Serving index.html from:', indexPath);
  res.sendFile(indexPath);
});

// Serve other static files
app.use(express.static(__dirname));

// Optimized Connection Pool with prepared statements
class ConnectionPool {
  constructor() {
    this.connections = new Map();
    this.statements = new Map();
    this.lastAccess = new Map();
    this.stats = new Map();
    
    // Cleanup idle connections every minute
    setInterval(() => this.cleanupIdleConnections(), 60000);
  }
  
  getConnection(projectPath) {
    const dbPath = path.join(projectPath, 'context_portal', 'context.db');
    
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      throw new Error(`ConPort database not found at ${dbPath}`);
    }
    
    // Return existing connection or create new one
    if (!this.connections.has(projectPath)) {
      console.log(`Creating new connection for ${projectPath}`);
      const db = new Database(dbPath, { readonly: false });
      
      // Optimize database performance
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = 10000');
      db.pragma('temp_store = MEMORY');
      db.pragma('mmap_size = 30000000000');
      
      this.connections.set(projectPath, db);
      this.prepareStatements(projectPath, db);
      this.stats.set(projectPath, { queries: 0, errors: 0 });
    }
    
    // Update last access time
    this.lastAccess.set(projectPath, Date.now());
    
    // Update stats
    const stats = this.stats.get(projectPath);
    stats.queries++;
    
    return this.connections.get(projectPath);
  }
  
  prepareStatements(projectPath, db) {
    const stmts = {
      // Product Context
      getProductContext: db.prepare('SELECT * FROM product_context ORDER BY id DESC LIMIT 1'),
      deleteProductContext: db.prepare('DELETE FROM product_context'),
      insertProductContext: db.prepare('INSERT INTO product_context (content) VALUES (?)'),
      
      // Active Context
      getActiveContext: db.prepare('SELECT * FROM active_context ORDER BY id DESC LIMIT 1'),
      deleteActiveContext: db.prepare('DELETE FROM active_context'),
      insertActiveContext: db.prepare('INSERT INTO active_context (content) VALUES (?)'),
      
      // Decisions
      getDecisions: db.prepare('SELECT * FROM decisions ORDER BY timestamp DESC LIMIT ?'),
      insertDecision: db.prepare(`
        INSERT INTO decisions (timestamp, summary, rationale, implementation_details, tags)
        VALUES (datetime('now'), ?, ?, ?, ?)
      `),
      deleteDecision: db.prepare('DELETE FROM decisions WHERE id = ?'),
      countDecisions: db.prepare('SELECT COUNT(*) as count FROM decisions'),
      
      // Progress
      getProgress: db.prepare('SELECT * FROM progress_entries ORDER BY timestamp DESC LIMIT ?'),
      insertProgress: db.prepare(`
        INSERT INTO progress_entries (timestamp, status, description, parent_id)
        VALUES (datetime('now'), ?, ?, ?)
      `),
      updateProgress: db.prepare(`
        UPDATE progress_entries SET status = ?, description = ? WHERE id = ?
      `),
      deleteProgress: db.prepare('DELETE FROM progress_entries WHERE id = ?'),
      countProgress: db.prepare('SELECT COUNT(*) as count FROM progress_entries'),
      
      // System Patterns
      getPatterns: db.prepare('SELECT * FROM system_patterns ORDER BY id DESC LIMIT ?'),
      insertPattern: db.prepare(`
        INSERT INTO system_patterns (timestamp, name, description, tags)
        VALUES (datetime('now'), ?, ?, ?)
      `),
      deletePattern: db.prepare('DELETE FROM system_patterns WHERE id = ?'),
      countPatterns: db.prepare('SELECT COUNT(*) as count FROM system_patterns'),
      
      // Custom Data
      getCustomData: db.prepare('SELECT * FROM custom_data ORDER BY id DESC'),
      getCustomDataByCategory: db.prepare('SELECT * FROM custom_data WHERE category = ? ORDER BY id DESC'),
      insertCustomData: db.prepare(`
        INSERT OR REPLACE INTO custom_data (timestamp, category, key, value)
        VALUES (datetime('now'), ?, ?, ?)
      `),
      deleteCustomData: db.prepare('DELETE FROM custom_data WHERE category = ? AND key = ?'),
      countCustomData: db.prepare('SELECT COUNT(*) as count FROM custom_data'),
    };
    
    this.statements.set(projectPath, stmts);
  }
  
  getStatements(projectPath) {
    this.getConnection(projectPath); // Ensure connection exists
    return this.statements.get(projectPath);
  }
  
  cleanupIdleConnections() {
    const now = Date.now();
    const maxIdle = 5 * 60 * 1000; // 5 minutes
    
    for (const [path, lastAccess] of this.lastAccess.entries()) {
      if (now - lastAccess > maxIdle) {
        console.log(`Closing idle connection for ${path}`);
        const db = this.connections.get(path);
        if (db) {
          db.close();
        }
        this.connections.delete(path);
        this.statements.delete(path);
        this.lastAccess.delete(path);
      }
    }
  }
  
  getStats(projectPath) {
    return this.stats.get(projectPath) || { queries: 0, errors: 0 };
  }
  
  closeAll() {
    for (const db of this.connections.values()) {
      db.close();
    }
    this.connections.clear();
    this.statements.clear();
    this.lastAccess.clear();
  }
}

// Optimized ConPort Database Operations
class ConPortDB {
  constructor(pool, workspacePath) {
    this.pool = pool;
    this.workspacePath = workspacePath;
  }
  
  // Product Context
  getProductContext() {
    const stmt = this.pool.getStatements(this.workspacePath).getProductContext;
    return stmt.get() || {};
  }
  
  updateProductContext(content) {
    const stmts = this.pool.getStatements(this.workspacePath);
    const db = this.pool.getConnection(this.workspacePath);
    
    const transaction = db.transaction(() => {
      stmts.deleteProductContext.run();
      stmts.insertProductContext.run(JSON.stringify(content));
    });
    
    transaction();
    return { success: true };
  }
  
  // Active Context
  getActiveContext() {
    const stmt = this.pool.getStatements(this.workspacePath).getActiveContext;
    return stmt.get() || {};
  }
  
  updateActiveContext(content) {
    const stmts = this.pool.getStatements(this.workspacePath);
    const db = this.pool.getConnection(this.workspacePath);
    
    const transaction = db.transaction(() => {
      stmts.deleteActiveContext.run();
      stmts.insertActiveContext.run(JSON.stringify(content));
    });
    
    transaction();
    return { success: true };
  }
  
  // Decisions
  getDecisions(limit = 100) {
    const stmt = this.pool.getStatements(this.workspacePath).getDecisions;
    return stmt.all(limit);
  }
  
  logDecision(data) {
    const stmt = this.pool.getStatements(this.workspacePath).insertDecision;
    const result = stmt.run(
      data.summary,
      data.rationale || null,
      data.implementation_details || null,
      data.tags ? JSON.stringify(data.tags) : null
    );
    
    return { id: result.lastInsertRowid, ...data, timestamp: new Date().toISOString() };
  }
  
  deleteDecision(id) {
    const stmt = this.pool.getStatements(this.workspacePath).deleteDecision;
    const result = stmt.run(id);
    return { success: result.changes > 0 };
  }
  
  // Progress
  getProgress(limit = 100) {
    const stmt = this.pool.getStatements(this.workspacePath).getProgress;
    return stmt.all(limit);
  }
  
  logProgress(data) {
    const stmt = this.pool.getStatements(this.workspacePath).insertProgress;
    const result = stmt.run(
      data.status,
      data.description,
      data.parent_id || null
    );
    
    return { id: result.lastInsertRowid, ...data, timestamp: new Date().toISOString() };
  }
  
  updateProgress(id, data) {
    const stmt = this.pool.getStatements(this.workspacePath).updateProgress;
    const result = stmt.run(
      data.status || 'TODO',
      data.description || '',
      id
    );
    return { success: result.changes > 0 };
  }
  
  deleteProgress(id) {
    const stmt = this.pool.getStatements(this.workspacePath).deleteProgress;
    const result = stmt.run(id);
    return { success: result.changes > 0 };
  }
  
  // System Patterns
  getSystemPatterns(limit = 100) {
    const stmt = this.pool.getStatements(this.workspacePath).getPatterns;
    return stmt.all(limit);
  }
  
  logSystemPattern(data) {
    const stmt = this.pool.getStatements(this.workspacePath).insertPattern;
    const result = stmt.run(
      data.name,
      data.description || null,
      data.tags ? JSON.stringify(data.tags) : null
    );
    
    return { id: result.lastInsertRowid, ...data, timestamp: new Date().toISOString() };
  }
  
  deleteSystemPattern(id) {
    const stmt = this.pool.getStatements(this.workspacePath).deletePattern;
    const result = stmt.run(id);
    return { success: result.changes > 0 };
  }
  
  // Custom Data
  getCustomData(category = null, key = null) {
    const stmts = this.pool.getStatements(this.workspacePath);
    let results;
    
    if (category) {
      results = stmts.getCustomDataByCategory.all(category);
    } else {
      results = stmts.getCustomData.all();
    }
    
    // Parse JSON values
    return results.map(row => ({
      ...row,
      value: this.tryParseJSON(row.value)
    }));
  }
  
  logCustomData(data) {
    const stmt = this.pool.getStatements(this.workspacePath).insertCustomData;
    const value = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
    const result = stmt.run(data.category, data.key, value);
    
    return { 
      id: result.lastInsertRowid, 
      ...data, 
      timestamp: new Date().toISOString() 
    };
  }
  
  deleteCustomData(category, key) {
    const stmt = this.pool.getStatements(this.workspacePath).deleteCustomData;
    const result = stmt.run(category, key);
    return { success: result.changes > 0 };
  }
  
  // Get counts for dashboard
  getCounts() {
    const stmts = this.pool.getStatements(this.workspacePath);
    return {
      decisions: stmts.countDecisions.get().count,
      progress: stmts.countProgress.get().count,
      patterns: stmts.countPatterns.get().count,
      customData: stmts.countCustomData.get().count
    };
  }
  
  // Search
  semanticSearch(query, limit = 20) {
    const db = this.pool.getConnection(this.workspacePath);
    const results = [];
    
    // Search decisions
    const decisionStmt = db.prepare(`
      SELECT * FROM decisions 
      WHERE summary LIKE ? OR rationale LIKE ? OR implementation_details LIKE ?
      ORDER BY timestamp DESC LIMIT ?
    `);
    const pattern = `%${query}%`;
    const decisions = decisionStmt.all(pattern, pattern, pattern, limit);
    decisions.forEach(d => results.push({ type: 'decision', item: d }));
    
    // Search progress
    const progressStmt = db.prepare(`
      SELECT * FROM progress_entries 
      WHERE description LIKE ? OR status LIKE ?
      ORDER BY timestamp DESC LIMIT ?
    `);
    const progress = progressStmt.all(pattern, pattern, limit);
    progress.forEach(p => results.push({ type: 'progress', item: p }));
    
    // Search custom data
    const customStmt = db.prepare(`
      SELECT * FROM custom_data 
      WHERE category LIKE ? OR key LIKE ? OR value LIKE ?
      ORDER BY id DESC LIMIT ?
    `);
    const customData = customStmt.all(pattern, pattern, pattern, limit);
    customData.forEach(c => results.push({ type: 'custom_data', item: c }));
    
    return results.slice(0, limit);
  }
  
  // Helper
  tryParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
}

// Project Manager with Connection Pooling
class ProjectManager {
  constructor() {
    this.pool = new ConnectionPool();
    this.projects = new Map();
    this.activeProjectId = null;
    this.configPath = path.join(__dirname, 'config', 'projects.json');
    this.recentPaths = [];
    this.loadProjects();
  }
  
  loadProjects() {
    // Load saved projects
    if (fs.existsSync(this.configPath)) {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      config.projects.forEach(project => {
        this.addProject(project);
      });
      
      // Set active project
      const active = config.projects.find(p => p.active);
      if (active) {
        this.setActiveProject(active.id);
      }
      
      // Load recent paths
      this.recentPaths = config.recentPaths || [];
    } else {
      // Default project (current workspace)
      this.addProject({
        id: 'default',
        name: 'Spec Driven Memory Bank',
        path: '/Users/pps/Documents/DEV/LAB/spec-driven-memory-bank-app',
        color: '#3498db',
        active: true
      });
      this.setActiveProject('default');
      this.saveProjects();
    }
  }
  
  saveProjects() {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const projects = Array.from(this.projects.values()).map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
      color: p.color,
      active: p.id === this.activeProjectId
    }));
    
    fs.writeFileSync(this.configPath, JSON.stringify({ 
      projects,
      recentPaths: this.recentPaths 
    }, null, 2));
  }
  
  addProject(project) {
    try {
      // Test connection with pool
      this.pool.getConnection(project.path);
      
      const db = new ConPortDB(this.pool, project.path);
      const counts = db.getCounts();
      
      this.projects.set(project.id, {
        ...project,
        db: db,
        connected: true,
        counts: counts
      });
      
      // Add to recent paths
      if (!this.recentPaths.includes(project.path)) {
        this.recentPaths.unshift(project.path);
        this.recentPaths = this.recentPaths.slice(0, 10); // Keep last 10
      }
      
      console.log(`Added project: ${project.name} (${project.id})`);
      console.log(`  Path: ${project.path}`);
      console.log(`  Stats: ${counts.decisions} decisions, ${counts.progress} progress, ${counts.customData} custom data`);
      return true;
    } catch (error) {
      console.error(`Failed to add project ${project.name}: ${error.message}`);
      this.projects.set(project.id, {
        ...project,
        db: null,
        connected: false,
        error: error.message
      });
      return false;
    }
  }
  
  setActiveProject(projectId) {
    if (this.projects.has(projectId)) {
      this.activeProjectId = projectId;
      console.log(`Active project: ${projectId}`);
      return true;
    }
    return false;
  }
  
  getActiveProject() {
    return this.projects.get(this.activeProjectId);
  }
  
  getProject(projectId) {
    return this.projects.get(projectId);
  }
  
  getAllProjects() {
    return Array.from(this.projects.values()).map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
      color: p.color,
      active: p.id === this.activeProjectId,
      connected: p.connected,
      counts: p.counts,
      error: p.error,
      stats: this.pool.getStats(p.path)
    }));
  }
  
  removeProject(projectId) {
    this.projects.delete(projectId);
    this.saveProjects();
  }
  
  getRecentPaths() {
    return this.recentPaths;
  }
}

// Initialize Project Manager
const projectManager = new ProjectManager();

// API Routes
app.post('/conport', async (req, res) => {
  const startTime = Date.now();
  const { method, params, projectId } = req.body;
  
  // Get the appropriate project
  const project = projectId ? 
    projectManager.getProject(projectId) : 
    projectManager.getActiveProject();
  
  if (!project || !project.connected) {
    return res.status(503).json({ 
      error: 'Project not connected',
      details: project?.error 
    });
  }
  
  const db = project.db;
  
  try {
    let result;
    
    switch(method) {
      // Context methods
      case 'get_product_context':
        result = db.getProductContext();
        break;
      case 'update_product_context':
        result = db.updateProductContext(params.content);
        break;
      case 'get_active_context':
        result = db.getActiveContext();
        break;
      case 'update_active_context':
        result = db.updateActiveContext(params.content);
        break;
        
      // Decisions
      case 'get_decisions':
        result = db.getDecisions(params.limit);
        break;
      case 'log_decision':
        result = db.logDecision(params);
        break;
      case 'delete_decision_by_id':
        result = db.deleteDecision(params.decision_id);
        break;
        
      // Progress
      case 'get_progress':
        result = db.getProgress(params.limit);
        break;
      case 'log_progress':
        result = db.logProgress(params);
        break;
      case 'update_progress':
        result = db.updateProgress(params.progress_id, params);
        break;
      case 'delete_progress_by_id':
        result = db.deleteProgress(params.progress_id);
        break;
        
      // System Patterns
      case 'get_system_patterns':
        result = db.getSystemPatterns(params.limit);
        break;
      case 'log_system_pattern':
        result = db.logSystemPattern(params);
        break;
      case 'delete_system_pattern_by_id':
        result = db.deleteSystemPattern(params.pattern_id);
        break;
        
      // Custom Data
      case 'get_custom_data':
        result = db.getCustomData(params.category, params.key);
        break;
      case 'log_custom_data':
        result = db.logCustomData(params);
        break;
      case 'delete_custom_data':
        result = db.deleteCustomData(params.category, params.key);
        break;
        
      // Search
      case 'semantic_search_conport':
        result = db.semanticSearch(params.query_text, params.top_k);
        break;
        
      default:
        return res.status(400).json({ error: `Unknown method: ${method}` });
    }
    
    const duration = Date.now() - startTime;
    console.log(`${method}: ${duration}ms`);
    
    res.json(result);
  } catch (error) {
    console.error(`Error in ${method}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Directory Browser API
app.post('/browse-directories', (req, res) => {
  const { currentPath = os.homedir() } = req.body;
  
  try {
    const dirs = fs.readdirSync(currentPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
      .map(dirent => ({
        name: dirent.name,
        path: path.join(currentPath, dirent.name),
        hasConPort: fs.existsSync(
          path.join(currentPath, dirent.name, 'context_portal', 'context.db')
        )
      }))
      .sort((a, b) => {
        if (a.hasConPort && !b.hasConPort) return -1;
        if (!a.hasConPort && b.hasConPort) return 1;
        return a.name.localeCompare(b.name);
      });
    
    res.json({ 
      currentPath,
      parentPath: path.dirname(currentPath),
      dirs 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Project Management API
app.get('/projects', (req, res) => {
  res.json({
    projects: projectManager.getAllProjects(),
    activeProjectId: projectManager.activeProjectId,
    recentPaths: projectManager.getRecentPaths()
  });
});

app.post('/projects', (req, res) => {
  const { id, name, path: projectPath, color } = req.body;
  
  const success = projectManager.addProject({
    id: id || Date.now().toString(),
    name: name || path.basename(projectPath),
    path: projectPath,
    color: color || '#' + Math.floor(Math.random()*16777215).toString(16)
  });
  
  if (success) {
    projectManager.saveProjects();
    res.json({ success: true, projects: projectManager.getAllProjects() });
  } else {
    res.status(400).json({ error: 'Failed to add project' });
  }
});

app.post('/projects/active', (req, res) => {
  const { projectId } = req.body;
  
  if (projectManager.setActiveProject(projectId)) {
    projectManager.saveProjects();
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Project not found' });
  }
});

app.delete('/projects/:id', (req, res) => {
  projectManager.removeProject(req.params.id);
  res.json({ success: true });
});

// Health check
app.get('/health', (req, res) => {
  const projects = projectManager.getAllProjects();
  res.json({ 
    status: 'ok', 
    port: PORT,
    activeProject: projectManager.activeProjectId,
    projectCount: projects.length,
    connected: projects.filter(p => p.connected).length,
    poolStats: projects.map(p => ({
      name: p.name,
      stats: p.stats
    }))
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   ConPort Navigator (Ultra-Optimized)  ║
║          Running on port ${PORT}          ║
║                                        ║
║   ⚡ Direct SQLite Connection           ║
║   🔄 Connection Pooling Active         ║
║   📊 Prepared Statements Ready         ║
║   🗂️  Multi-Project Support            ║
║                                        ║
║     Open in browser:                   ║
║     http://localhost:${PORT}              ║
╚════════════════════════════════════════╝
  `);
  
  console.log('\n📁 Connected Projects:');
  projectManager.getAllProjects().forEach(p => {
    console.log(`  ${p.active ? '✓' : ' '} ${p.name}`);
    console.log(`    Path: ${p.path}`);
    if (p.connected && p.counts) {
      console.log(`    Data: ${p.counts.decisions} decisions, ${p.counts.progress} progress, ${p.counts.customData} custom`);
    }
  });
  
  console.log('\n⚡ Performance optimizations active:');
  console.log('  • Connection pooling enabled');
  console.log('  • Prepared statements cached');
  console.log('  • WAL mode + memory temp store');
  console.log('  • Idle connection cleanup');
});