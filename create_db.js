const Database = require('better-sqlite3');
const db = new Database('context_portal/context.db', { verbose: console.log });

const schema = `
CREATE TABLE active_context (id INTEGER NOT NULL, content TEXT NOT NULL, PRIMARY KEY (id));
CREATE TABLE active_context_history (id INTEGER NOT NULL, timestamp DATETIME NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL, change_source VARCHAR(255), PRIMARY KEY (id));
CREATE TABLE context_links (id INTEGER NOT NULL, workspace_id VARCHAR(1024) NOT NULL, source_item_type VARCHAR(255) NOT NULL, source_item_id VARCHAR(255) NOT NULL, target_item_type VARCHAR(255) NOT NULL, target_item_id VARCHAR(255) NOT NULL, relationship_type VARCHAR(255) NOT NULL, description TEXT, timestamp DATETIME DEFAULT (CURRENT_TIMESTAMP) NOT NULL, PRIMARY KEY (id));
CREATE INDEX ix_context_links_source_item_id ON context_links (source_item_id);
CREATE INDEX ix_context_links_source_item_type ON context_links (source_item_type);
CREATE INDEX ix_context_links_target_item_id ON context_links (target_item_id);
CREATE INDEX ix_context_links_target_item_type ON context_links (target_item_type);
CREATE TABLE custom_data (id INTEGER NOT NULL, timestamp DATETIME NOT NULL, category VARCHAR(255) NOT NULL, key VARCHAR(255) NOT NULL, value TEXT NOT NULL, PRIMARY KEY (id), UNIQUE (category, key));
CREATE TABLE decisions (id INTEGER NOT NULL, timestamp DATETIME NOT NULL, summary TEXT NOT NULL, rationale TEXT, implementation_details TEXT, tags TEXT, PRIMARY KEY (id));
CREATE TABLE product_context (id INTEGER NOT NULL, content TEXT NOT NULL, PRIMARY KEY (id));
CREATE TABLE product_context_history (id INTEGER NOT NULL, timestamp DATETIME NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL, change_source VARCHAR(255), PRIMARY KEY (id));
CREATE TABLE progress_entries (id INTEGER NOT NULL, timestamp DATETIME NOT NULL, status VARCHAR(50) NOT NULL, description TEXT NOT NULL, parent_id INTEGER, PRIMARY KEY (id), FOREIGN KEY(parent_id) REFERENCES progress_entries (id) ON DELETE SET NULL);
CREATE TABLE system_patterns (id INTEGER NOT NULL, timestamp DATETIME NOT NULL, name VARCHAR(255) NOT NULL, description TEXT, tags TEXT, PRIMARY KEY (id), UNIQUE (name));
INSERT INTO product_context (id, content) VALUES (1, '{}');
INSERT INTO active_context (id, content) VALUES (1, '{}');
CREATE VIRTUAL TABLE decisions_fts USING fts5(summary, rationale, implementation_details, tags, content="decisions", content_rowid="id");
CREATE TRIGGER decisions_after_insert AFTER INSERT ON decisions BEGIN INSERT INTO decisions_fts (rowid, summary, rationale, implementation_details, tags) VALUES (new.id, new.summary, new.rationale, new.implementation_details, new.tags); END;
CREATE TRIGGER decisions_after_delete AFTER DELETE ON decisions BEGIN INSERT INTO decisions_fts (decisions_fts, rowid, summary, rationale, implementation_details, tags) VALUES ('delete', old.id, old.summary, old.rationale, old.implementation_details, old.tags); END;
CREATE TRIGGER decisions_after_update AFTER UPDATE ON decisions BEGIN INSERT INTO decisions_fts (decisions_fts, rowid, summary, rationale, implementation_details, tags) VALUES ('delete', old.id, old.summary, old.rationale, old.implementation_details, old.tags); INSERT INTO decisions_fts (rowid, summary, rationale, implementation_details, tags) VALUES (new.id, new.summary, new.rationale, new.implementation_details, new.tags); END;
CREATE VIRTUAL TABLE custom_data_fts USING fts5(category, key, value_text, content="custom_data", content_rowid="id");
CREATE TRIGGER custom_data_after_insert AFTER INSERT ON custom_data BEGIN INSERT INTO custom_data_fts (rowid, category, key, value_text) VALUES (new.id, new.category, new.key, new.value); END;
CREATE TRIGGER custom_data_after_delete AFTER DELETE ON custom_data BEGIN INSERT INTO custom_data_fts (custom_data_fts, rowid, category, key, value_text) VALUES ('delete', old.id, old.category, old.key, old.value); END;
CREATE TRIGGER custom_data_after_update AFTER UPDATE ON custom_data BEGIN INSERT INTO custom_data_fts (custom_data_fts, rowid, category, key, value_text) VALUES ('delete', old.id, old.category, old.key, old.value); INSERT INTO custom_data_fts (rowid, category, key, value_text) VALUES (new.id, new.category, new.key, new.value); END;
INSERT INTO decisions (id, timestamp, summary, rationale, implementation_details, tags) VALUES (1, '2025-08-15 00:00:00', 'Test Decision', 'This is a test decision.', 'None', '["test"]');
`;

db.exec(schema);
db.close();
