#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Accept optional path parameter
const dbPath = process.argv[2] || 'context_portal/context.db';
const dbDir = path.dirname(dbPath);

// Ensure directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`✅ Created directory: ${dbDir}`);
}

// Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log(`🗑️  Removed existing database: ${dbPath}`);
}

console.log(`📦 Creating new ConPort database at: ${dbPath}`);

const db = new Database(dbPath, { verbose: console.log });

try {
  // Start transaction for schema creation
  db.transaction(() => {
    console.log('📋 Creating tables...');
    
    // Core tables
    db.exec(`
      -- Alembic version tracking
      CREATE TABLE alembic_version (
        version_num VARCHAR(32) NOT NULL, 
        CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
      );
      
      -- Active context
      CREATE TABLE active_context (
        id INTEGER NOT NULL, 
        content TEXT NOT NULL, 
        PRIMARY KEY (id)
      );
      
      -- Active context history
      CREATE TABLE active_context_history (
        id INTEGER NOT NULL, 
        timestamp DATETIME NOT NULL, 
        version INTEGER NOT NULL, 
        content TEXT NOT NULL, 
        change_source VARCHAR(255), 
        PRIMARY KEY (id)
      );
      
      -- Context links for knowledge graph
      CREATE TABLE context_links (
        id INTEGER NOT NULL, 
        workspace_id VARCHAR(1024) NOT NULL, 
        source_item_type VARCHAR(255) NOT NULL, 
        source_item_id VARCHAR(255) NOT NULL, 
        target_item_type VARCHAR(255) NOT NULL, 
        target_item_id VARCHAR(255) NOT NULL, 
        relationship_type VARCHAR(255) NOT NULL, 
        description TEXT, 
        timestamp DATETIME DEFAULT (CURRENT_TIMESTAMP) NOT NULL, 
        PRIMARY KEY (id)
      );
      
      -- Indexes for context links
      CREATE INDEX ix_context_links_source_item_id ON context_links (source_item_id);
      CREATE INDEX ix_context_links_source_item_type ON context_links (source_item_type);
      CREATE INDEX ix_context_links_target_item_id ON context_links (target_item_id);
      CREATE INDEX ix_context_links_target_item_type ON context_links (target_item_type);
      
      -- Custom data storage
      CREATE TABLE custom_data (
        id INTEGER NOT NULL, 
        timestamp DATETIME NOT NULL, 
        category VARCHAR(255) NOT NULL, 
        "key" VARCHAR(255) NOT NULL, 
        value TEXT NOT NULL, 
        PRIMARY KEY (id), 
        UNIQUE (category, "key")
      );
      
      -- Decisions table
      CREATE TABLE decisions (
        id INTEGER NOT NULL, 
        timestamp DATETIME NOT NULL, 
        summary TEXT NOT NULL, 
        rationale TEXT, 
        implementation_details TEXT, 
        tags TEXT, 
        PRIMARY KEY (id)
      );
      
      -- Product context
      CREATE TABLE product_context (
        id INTEGER NOT NULL, 
        content TEXT NOT NULL, 
        PRIMARY KEY (id)
      );
      
      -- Product context history
      CREATE TABLE product_context_history (
        id INTEGER NOT NULL, 
        timestamp DATETIME NOT NULL, 
        version INTEGER NOT NULL, 
        content TEXT NOT NULL, 
        change_source VARCHAR(255), 
        PRIMARY KEY (id)
      );
      
      -- Progress entries
      CREATE TABLE progress_entries (
        id INTEGER NOT NULL, 
        timestamp DATETIME NOT NULL, 
        status VARCHAR(50) NOT NULL, 
        description TEXT NOT NULL, 
        parent_id INTEGER, 
        PRIMARY KEY (id), 
        FOREIGN KEY(parent_id) REFERENCES progress_entries (id) ON DELETE SET NULL
      );
      
      -- System patterns
      CREATE TABLE system_patterns (
        id INTEGER NOT NULL, 
        timestamp DATETIME NOT NULL, 
        name VARCHAR(255) NOT NULL, 
        description TEXT, 
        tags TEXT, 
        PRIMARY KEY (id), 
        UNIQUE (name)
      );
    `);
    
    console.log('🔍 Creating FTS tables and triggers...');
    
    // FTS for decisions
    db.exec(`
      CREATE VIRTUAL TABLE decisions_fts USING fts5(
        summary, 
        rationale, 
        implementation_details, 
        tags, 
        content="decisions", 
        content_rowid="id"
      );
      
      CREATE TRIGGER decisions_after_insert AFTER INSERT ON decisions
      BEGIN
        INSERT INTO decisions_fts (rowid, summary, rationale, implementation_details, tags)
        VALUES (new.id, new.summary, new.rationale, new.implementation_details, new.tags);
      END;
      
      CREATE TRIGGER decisions_after_delete AFTER DELETE ON decisions
      BEGIN
        INSERT INTO decisions_fts (decisions_fts, rowid, summary, rationale, implementation_details, tags)
        VALUES ('delete', old.id, old.summary, old.rationale, old.implementation_details, old.tags);
      END;
      
      CREATE TRIGGER decisions_after_update AFTER UPDATE ON decisions
      BEGIN
        INSERT INTO decisions_fts (decisions_fts, rowid, summary, rationale, implementation_details, tags)
        VALUES ('delete', old.id, old.summary, old.rationale, old.implementation_details, old.tags);
        INSERT INTO decisions_fts (rowid, summary, rationale, implementation_details, tags)
        VALUES (new.id, new.summary, new.rationale, new.implementation_details, new.tags);
      END;
    `);
    
    // FTS for custom data
    db.exec(`
      CREATE VIRTUAL TABLE custom_data_fts USING fts5(
        category,
        key,
        value_text,
        content="custom_data",
        content_rowid="id"
      );
      
      CREATE TRIGGER custom_data_after_insert AFTER INSERT ON custom_data
      BEGIN
        INSERT INTO custom_data_fts (rowid, category, key, value_text)
        VALUES (new.id, new.category, new.key, new.value);
      END;
      
      CREATE TRIGGER custom_data_after_delete AFTER DELETE ON custom_data
      BEGIN
        INSERT INTO custom_data_fts (custom_data_fts, rowid, category, key, value_text)
        VALUES ('delete', old.id, old.category, old.key, old.value);
      END;
      
      CREATE TRIGGER custom_data_after_update AFTER UPDATE ON custom_data
      BEGIN
        INSERT INTO custom_data_fts (custom_data_fts, rowid, category, key, value_text)
        VALUES ('delete', old.id, old.category, old.key, old.value);
        INSERT INTO custom_data_fts (rowid, category, key, value_text)
        VALUES (new.id, new.category, new.key, new.value);
      END;
    `);
  })();
  
  console.log('✅ Schema created successfully');
  
  // Insert test data in transaction
  db.transaction(() => {
    console.log('📝 Inserting test data...');
    
    // Alembic version
    db.prepare('INSERT INTO alembic_version (version_num) VALUES (?)').run('20250617');
    
    // Initialize empty contexts
    db.prepare('INSERT INTO product_context (id, content) VALUES (?, ?)').run(1, '{}');
    db.prepare('INSERT INTO active_context (id, content) VALUES (?, ?)').run(1, '{}');
    
    // Decisions
    const insertDecision = db.prepare(`
      INSERT INTO decisions (id, timestamp, summary, rationale, implementation_details, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    insertDecision.run(
      1,
      '2025-01-15 07:30:53.398082',
      'Initialize ConPort Navigator project with comprehensive documentation',
      'Establish a structured foundation for the ConPort Navigator project by creating comprehensive documentation (projectBrief.md) that captures the project\'s purpose, architecture, and development approach. This enables consistent understanding across AI sessions and team members.',
      'Created projectBrief.md with complete project overview including architecture (three-tier with connection pooling), technology stack (Node.js/Express/SQLite), core features (100x performance improvement), and development methodology. The brief serves as the single source of truth for project understanding.',
      null
    );
    
    insertDecision.run(
      2,
      '2025-01-15 08:22:39.946968',
      'Complete ConPort initialization for ConPort Navigator project',
      'Establish comprehensive ConPort memory system for the project. This enables persistent context across AI sessions, semantic search capabilities, and structured project knowledge management.',
      'Set up product context with project details, technology stack, and architecture. Initialized active context for current session. Created three core system patterns: Direct SQLite Access (100x performance), Three-Tier Architecture, and ConPort Memory Management. All data stored in ConPort database for future reference.',
      null
    );
    
    insertDecision.run(
      3,
      '2025-01-15 09:00:00.000000',
      'Adopt Direct SQLite Access for 100x performance improvement',
      'Bypass MCP protocol overhead by implementing direct SQLite database access with connection pooling. This architectural decision prioritizes performance while maintaining compatibility with ConPort data structures.',
      'Implemented ConnectionPool class in server.js with prepared statements, WAL mode, and optimized pragmas. Results show query times reduced from 100ms to under 1ms, achieving the target 100x improvement.',
      '["performance", "architecture", "database"]'
    );
    
    // System Patterns
    const insertPattern = db.prepare(`
      INSERT INTO system_patterns (id, timestamp, name, description, tags)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertPattern.run(
      1,
      '2025-01-15 08:22:08.758285',
      'Direct SQLite Access Pattern',
      'Bypass MCP protocol and use direct SQLite connections with connection pooling for 100x performance improvement. Use prepared statements and WAL mode for optimal database performance.',
      null
    );
    
    insertPattern.run(
      2,
      '2025-01-15 08:22:15.556450',
      'Three-Tier Architecture Pattern',
      'Separate concerns into Frontend SPA (Vanilla JS), Express Backend with ConnectionPool, and SQLite Database Layer. Maintain clear boundaries between presentation, business logic, and data access.',
      null
    );
    
    insertPattern.run(
      3,
      '2025-01-15 08:22:22.350682',
      'ConPort Memory Management',
      'Use ConPort for persistent project memory and semantic search across features. Store decisions, progress, patterns, and custom data for AI-assisted development continuity.',
      null
    );
    
    // Custom Data
    const insertCustomData = db.prepare(`
      INSERT INTO custom_data (id, timestamp, category, key, value)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    // Project context data
    const projectContextData = {
      project_name: "ConPort Navigator",
      description: "A production-ready web application for browsing, searching, and editing ConPort (Context Portal MCP) data with 100x performance improvement over MCP protocol through direct SQLite access and connection pooling.",
      technology_stack: {
        languages: ["JavaScript", "HTML", "CSS", "SQL"],
        frameworks: ["Express 5.1.0", "CodeMirror 6"],
        runtime: "Node.js 14+",
        database: "SQLite3 via better-sqlite3",
        testing: "Playwright"
      },
      architecture: {
        type: "Three-tier architecture",
        components: [
          "Frontend SPA (Vanilla JS)",
          "Express Backend with ConnectionPool",
          "SQLite Database Layer"
        ],
        performance_features: [
          "Direct SQLite access (bypassing MCP)",
          "Connection pooling with prepared statements",
          "WAL mode and optimized pragmas",
          "Memory-mapped I/O"
        ]
      },
      core_features: [
        "Multi-project management",
        "Full CRUD operations for all ConPort types",
        "Advanced JSON editor with syntax highlighting",
        "Semantic search across project data",
        "Real-time validation and error detection",
        "100x faster than MCP protocol"
      ],
      initialized_date: "2025-01-15",
      brief_location: "./projectBrief.md",
      version: "1.0.0",
      license: "Apache 2.0"
    };
    
    insertCustomData.run(
      1,
      '2025-01-15 08:09:28.608025',
      'ProjectContext',
      'conport-navigator-brief',
      JSON.stringify(projectContextData, null, 2)
    );
    
    // Product initialization data
    const productInitData = {
      project: {
        name: "ConPort Navigator",
        description: "Production-ready web application for browsing, searching, and editing ConPort (Context Portal MCP) data with 100x performance improvement",
        type: "web_application",
        repository: "git@github.com:CaptainMemo-app/conport-navigator.git",
        initialized_date: "2025-01-15"
      },
      technology_stack: {
        primary_language: "JavaScript",
        framework: "Express + Vanilla JS",
        database: "SQLite (better-sqlite3)",
        editor: "CodeMirror 6",
        testing: "Playwright",
        tools: ["Claude Code", "ConPort MCP", "npm"]
      },
      architecture: {
        style: "Three-tier architecture",
        components: ["Frontend SPA", "Express Backend", "SQLite Database Layer"],
        patterns: ["Connection Pooling", "Prepared Statements", "RESTful API", "Single Page Application"]
      },
      development: {
        methodology: "Performance-first development",
        ai_tools: ["Claude Code", "GitHub Copilot"],
        memory_system: "ConPort",
        spec_approach: "spec-driven"
      },
      workspace: {
        path: "/Users/pps/Documents/DEV/LAB/conport-navigator",
        main_branch: "main",
        current_branch: "ui-fix-1"
      }
    };
    
    insertCustomData.run(
      2,
      '2025-01-15 08:17:13.472033',
      'ProductContext',
      'initialization',
      JSON.stringify(productInitData, null, 2)
    );
    
    // Active context session data
    const activeContextData = {
      current_focus: {
        type: "initialization",
        description: "Setting up ConPort and spec-driven development",
        branch: "ui-fix-1",
        started_at: "2025-01-15T09:17:00Z"
      },
      workspace_info: {
        path: "/Users/pps/Documents/DEV/LAB/conport-navigator",
        git_status: "clean",
        last_activity: "2025-01-15T09:17:00Z"
      },
      session_config: {
        spec_templates_ready: false,
        development_mode: "setup"
      }
    };
    
    insertCustomData.run(
      3,
      '2025-01-15 08:21:49.419935',
      'ActiveContext',
      'current_session',
      JSON.stringify(activeContextData, null, 2)
    );
    
    // Progress Entries
    const insertProgress = db.prepare(`
      INSERT INTO progress_entries (id, timestamp, status, description, parent_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertProgress.run(
      1,
      '2025-01-14 10:00:00.000000',
      'DONE',
      'Set up Express server with connection pooling',
      null
    );
    
    insertProgress.run(
      2,
      '2025-01-14 14:00:00.000000',
      'DONE',
      'Implement CodeMirror editor integration',
      null
    );
    
    insertProgress.run(
      3,
      '2025-01-14 18:00:00.000000',
      'DONE',
      'Create multi-project management system',
      null
    );
    
    insertProgress.run(
      4,
      '2025-01-15 08:00:00.000000',
      'IN_PROGRESS',
      'Add semantic search functionality',
      null
    );
    
    insertProgress.run(
      5,
      '2025-01-15 09:00:00.000000',
      'TODO',
      'Write comprehensive test suite',
      null
    );
    
    // Context Links
    const insertLink = db.prepare(`
      INSERT INTO context_links (id, workspace_id, source_item_type, source_item_id, 
                                target_item_type, target_item_id, relationship_type, 
                                description, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertLink.run(
      1,
      '/Users/pps/Documents/DEV/LAB/conport-navigator',
      'decision',
      '3',
      'system_pattern',
      '1',
      'implements',
      'Decision to adopt direct SQLite access implements the Direct SQLite Access Pattern',
      '2025-01-15 09:30:00.000000'
    );
    
    insertLink.run(
      2,
      '/Users/pps/Documents/DEV/LAB/conport-navigator',
      'progress_entry',
      '1',
      'system_pattern',
      '2',
      'follows',
      'Server setup follows the Three-Tier Architecture Pattern',
      '2025-01-15 09:31:00.000000'
    );
  })();
  
  console.log('✅ Test data inserted successfully');
  
  // Verify the database
  console.log('\n📊 Database verification:');
  const counts = {
    decisions: db.prepare('SELECT COUNT(*) as count FROM decisions').get().count,
    patterns: db.prepare('SELECT COUNT(*) as count FROM system_patterns').get().count,
    custom_data: db.prepare('SELECT COUNT(*) as count FROM custom_data').get().count,
    progress: db.prepare('SELECT COUNT(*) as count FROM progress_entries').get().count,
    links: db.prepare('SELECT COUNT(*) as count FROM context_links').get().count
  };
  
  console.log(`  - Decisions: ${counts.decisions}`);
  console.log(`  - System Patterns: ${counts.patterns}`);
  console.log(`  - Custom Data: ${counts.custom_data}`);
  console.log(`  - Progress Entries: ${counts.progress}`);
  console.log(`  - Context Links: ${counts.links}`);
  
  console.log('\n✨ ConPort database created successfully!');
  console.log(`📍 Location: ${dbPath}`);
  
} catch (error) {
  console.error('❌ Error creating database:', error);
  process.exit(1);
} finally {
  db.close();
}