# AGENTS.md

AI Agent guidance for ConPort Navigator codebase. Optimized for GitHub Copilot, Google AI, and other coding assistants.

## Quick Context

**Project**: ConPort Navigator - Web UI for ConPort (Context Portal MCP) databases
**Purpose**: Browse, search, and edit project memory stored in SQLite
**Stack**: Node.js/Express backend, Vanilla JS frontend, SQLite direct access
**Performance**: 100x faster than MCP protocol through connection pooling

## Code Patterns to Follow

### Backend Patterns (server.js)

#### Database Access Pattern
```javascript
// ALWAYS use the connection pool, never create direct connections
const db = connectionPool.getConnection(projectPath);
const stmt = connectionPool.getStatement(projectPath, 'queryName');
const result = stmt.get(params);
```

#### API Endpoint Pattern
```javascript
app.post('/api/conport/:type/:action', async (req, res) => {
  const { workspace_id } = req.body;
  try {
    const db = connectionPool.getConnection(workspace_id);
    // Use prepared statements from pool
    const result = connectionPool.statements.get(workspace_id).queryName.run();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Frontend Patterns (app-simple.js)

#### API Call Pattern
```javascript
async function callConPortAPI(type, action, data) {
  const response = await fetch(`${API_BASE}/api/conport/${type}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workspace_id: getCurrentProjectPath(),
      ...data
    })
  });
  return response.json();
}
```

#### State Update Pattern
```javascript
// Always update state before UI
currentItem = newData;
currentType = dataType;
// Then update UI
updateDisplay();
updateEditor();
```

### Editor Integration (codemirror-integration.js)

#### CodeMirror Setup Pattern
```javascript
// Use these exact imports and extensions
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';

// Always include JSON linting
const jsonLinter = linter(view => {
  try {
    JSON.parse(view.state.doc.toString());
    return [];
  } catch (e) {
    // Return error position
  }
});
```

## Database Queries

### ConPort Table Patterns

#### Context Tables (product_context, active_context)
```sql
-- Get latest context
SELECT * FROM [table_name] ORDER BY id DESC LIMIT 1

-- Update context (delete and insert)
DELETE FROM [table_name];
INSERT INTO [table_name] (content) VALUES (?)
```

#### Multi-Record Tables (decisions, progress, system_patterns)
```sql
-- List with limit
SELECT * FROM [table_name] ORDER BY timestamp DESC LIMIT ?

-- Insert with timestamp
INSERT INTO [table_name] (timestamp, ...) VALUES (datetime('now'), ...)

-- Delete by ID
DELETE FROM [table_name] WHERE id = ?
```

#### Custom Data Pattern
```sql
-- Get by category and key
SELECT * FROM custom_data WHERE category = ? AND key = ?

-- Upsert pattern
INSERT OR REPLACE INTO custom_data (category, key, value) VALUES (?, ?, ?)
```

## Component Responsibilities

### ConnectionPool Class
- **Manages**: SQLite connections per project
- **Optimizes**: Prepared statements, connection reuse
- **Cleans**: Idle connections after 5 minutes
- **Never**: Create connections outside this class

### Project Manager
- **Tracks**: Active project in config/projects.json
- **Validates**: Database existence before operations
- **Updates**: UI project selector
- **Handles**: Project switching

### Editor Controller
- **Formats**: JSON for display
- **Validates**: JSON before save
- **Shows**: Parse errors inline
- **Manages**: Edit/Preview/Raw modes

## API Endpoints Reference

```javascript
// Project Management
GET  /projects              // List all projects
POST /projects              // Add new project
PUT  /projects/:id          // Update project
DELETE /projects/:id        // Remove project

// ConPort Operations
POST /api/conport/:type/get     // Fetch data
POST /api/conport/:type/update  // Update data
POST /api/conport/:type/create  // Create new item
POST /api/conport/:type/delete  // Delete item
POST /api/conport/search         // Semantic search
```

## State Management

### Global State Variables
```javascript
let currentProjects = [];     // All configured projects
let activeProjectId = null;   // Currently selected project
let currentType = null;       // Active data type (decisions, progress, etc.)
let currentItems = [];        // List of items for current type
let currentItem = null;       // Selected item for editing
```

### State Flow
1. User selects project → Update `activeProjectId`
2. User selects data type → Update `currentType` → Fetch items
3. User selects item → Update `currentItem` → Display in editor
4. User saves → Update database → Refresh `currentItems`

## Error Handling

### Database Errors
```javascript
// Always wrap database calls
try {
  const result = db.prepare(query).get();
} catch (error) {
  if (error.code === 'SQLITE_CANTOPEN') {
    // Database doesn't exist
  } else if (error.code === 'SQLITE_BUSY') {
    // Retry with backoff
  }
}
```

### JSON Validation
```javascript
// Validate before save
try {
  const parsed = JSON.parse(jsonString);
  // Additional schema validation here
} catch (e) {
  // Show error in editor
  showJsonError(e.message, e.lineNumber);
}
```

## Performance Guidelines

### DO
- Use prepared statements from ConnectionPool
- Batch operations when possible
- Cache frequently accessed data
- Use pagination for large result sets

### DON'T
- Create new database connections per request
- Parse JSON multiple times
- Block UI during database operations
- Store large blobs in the database

## Testing Patterns

### UI Test Pattern (Playwright)
```javascript
test('should perform action', async ({ page }) => {
  await page.goto('http://localhost:3456');
  await page.waitForSelector('#project-select option');
  await page.click('[data-type="decisions"]');
  await expect(page.locator('.cm-editor')).toBeVisible();
});
```

### Integration Test Pattern
```javascript
// Test database operations directly
const db = new Database(':memory:');
db.exec(fs.readFileSync('schema.sql', 'utf8'));
// Run tests against in-memory database
```

## Common Tasks

### Add New Data Type
1. Add table to schema in create_db.js
2. Add prepared statements to ConnectionPool
3. Add API endpoints in server.js
4. Add UI handlers in app-simple.js
5. Add type to navigation sidebar

### Optimize Query Performance
1. Add index to frequently queried columns
2. Create prepared statement in ConnectionPool
3. Use statement.all() for multiple rows
4. Consider pagination for large results

### Add Export Feature
1. Create export endpoint in server.js
2. Query all relevant tables
3. Format as JSON or Markdown
4. Stream response for large exports

## Security Checklist

- [ ] Parameterize all SQL queries (no string concatenation)
- [ ] Validate JSON schema before database writes
- [ ] Sanitize file paths for project directories
- [ ] Limit result set sizes to prevent memory issues
- [ ] Use read-only connections where possible

## Debugging Tips

### Check Connection Pool
```javascript
console.log('Active connections:', connectionPool.connections.size);
console.log('Prepared statements:', connectionPool.statements.size);
console.log('Connection stats:', connectionPool.stats);
```

### Monitor SQLite Performance
```sql
EXPLAIN QUERY PLAN SELECT ...;  -- Check query efficiency
PRAGMA table_info(table_name);  -- Verify schema
PRAGMA index_list(table_name);  -- Check indexes
```

### Debug Frontend State
```javascript
// In browser console
console.table(currentProjects);
console.log('Active:', activeProjectId);
console.log('Current type:', currentType);
console.log('Items:', currentItems.length);
```

## File Modification Guidelines

### When Modifying server.js
- Maintain ConnectionPool singleton pattern
- Add new queries as prepared statements
- Keep CORS headers consistent
- Log errors with context

### When Modifying app-simple.js
- Update state before UI
- Keep API calls in dedicated functions
- Handle loading states
- Maintain project selector sync

### When Modifying codemirror-integration.js
- Preserve JSON linting
- Keep error positioning accurate
- Maintain formatting consistency
- Don't break keyboard shortcuts

## Import Hierarchy

```
server.js
├── express
├── better-sqlite3
├── chokidar (file watching)
└── ConnectionPool (internal)

app-simple.js
├── No imports (vanilla JS)
└── Global API_BASE constant

codemirror-integration.js
├── @codemirror/state
├── @codemirror/view
├── @codemirror/lang-json
└── @codemirror/lint
```

## Configuration Files

### config/projects.json
- Stores project list and active state
- Auto-created if missing
- Updated on project add/remove

### context_portal/context.db
- SQLite database per project
- Created by ConPort initialization
- Contains all project memory

### package.json scripts
- `start`: Run optimized server
- `start:mcp`: Run with MCP protocol
- `start:improved`: Direct SQLite mode

## Remember

1. **Performance First**: Direct SQLite is 100x faster than MCP
2. **Connection Pooling**: Never create direct database connections
3. **Prepared Statements**: Always use parameterized queries
4. **State Management**: Update state before UI
5. **Error Handling**: Graceful degradation for missing databases
6. **JSON Validation**: Validate before save, show errors inline
7. **Project Context**: Always include workspace_id in operations