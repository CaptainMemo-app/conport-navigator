# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ConPort Navigator is a production-ready web application for browsing, searching, and editing ConPort (Context Portal MCP) data. It provides direct SQLite database access for 100x faster performance than MCP protocol calls, with connection pooling and optimized queries.

## Commands

### Development Commands
```bash
# Install dependencies
npm install

# Start the optimized server (recommended)
npm start
# or
npm run start:improved

# Alternative server modes
npm run start:mcp        # Uses MCP protocol (slower)
npm run start:optimized  # Direct SQLite (fastest)

# Run tests
npx playwright test

# Start with auto-restart on crash
./start.sh
```

### Database Operations
```bash
# Create a new ConPort database
node create_db.js <workspace_path>

# Or use the shell script
./create_db.sh <workspace_path>
```

## Architecture

### System Overview
The application follows a three-tier architecture:
1. **Frontend**: Vanilla JavaScript SPA with native HTML5 elements
2. **Backend**: Express server with SQLite connection pooling
3. **Database**: ConPort SQLite databases (one per project)

### Key Components

#### Server (server.js)
- Express server on port 3456
- **ConnectionPool class**: Manages SQLite connections with prepared statements
- Direct database access bypassing MCP for performance
- Automatic connection cleanup for idle databases
- CORS enabled for cross-origin requests

#### Frontend Application (app-simple.js)
- **State Management**: Simple global state for projects, items, and UI
- **Project Management**: Multi-project support with project selector
- **Data Operations**: Full CRUD for all ConPort data types
- **Search**: Semantic search across all project data
- **Editor Integration**: Coordinates with CodeMirror for JSON editing

#### Editor Enhancement (codemirror-integration.js)
- CodeMirror 6 setup with JSON language support
- Custom error handling for malformed JSON
- Provides syntax highlighting and auto-formatting

### Data Flow
```
User Action → app-simple.js → fetch() → Express Server → SQLite → ConPort DB
                    ↑                                              ↓
                CodeMirror ← JSON formatting ← Response ← Query Results
```

### ConPort Data Types
The application handles these ConPort data structures:
- `product_context`: Single record with JSON content field
- `active_context`: Single record with JSON content field  
- `decisions`: Multiple records with summary, rationale, tags
- `progress`: Task tracking with status and parent relationships
- `system_patterns`: Design patterns with name and description
- `custom_data`: Key-value storage with category grouping

## Database Schema

All ConPort databases follow this structure:
- **Context tables** (product_context, active_context): id, content (JSON), timestamp
- **Decision table**: id, timestamp, summary, rationale, implementation_details, tags
- **Progress table**: id, timestamp, status, description, parent_id, linked_item_type, linked_item_id
- **System patterns**: id, timestamp, name, description, tags
- **Custom data**: id, timestamp, category, key, value (JSON)

## Performance Optimizations

The server uses several SQLite optimizations:
```sql
PRAGMA journal_mode = WAL;      -- Write-Ahead Logging
PRAGMA synchronous = NORMAL;    -- Balanced durability/speed
PRAGMA cache_size = 10000;      -- Larger page cache
PRAGMA temp_store = MEMORY;     -- In-memory temp tables
PRAGMA mmap_size = 30000000000; -- Memory-mapped I/O
```

Prepared statements are cached per connection to avoid query compilation overhead.

## Project Configuration

Projects are stored in `config/projects.json`:
```json
{
  "projects": [{
    "id": "unique_id",
    "name": "Project Name",
    "path": "/absolute/path/to/project",
    "color": "#3498db",
    "active": true
  }]
}
```

The active project determines which database is queried by default.

## Error Handling

The application handles several error conditions:
- Missing ConPort database: Returns 404 with helpful message
- Malformed JSON: CodeMirror displays parse errors inline
- Connection failures: Automatic retry with exponential backoff
- Stale connections: Cleaned up after 5 minutes of inactivity

## Testing

UI tests use Playwright to verify:
- Project loading and switching
- Data type navigation
- JSON syntax highlighting in CodeMirror
- CRUD operations
- Search functionality

Run tests with: `npx playwright test`

## Port Configuration

Default port is 3456. If occupied, the start.sh script will:
1. Detect the conflict using lsof
2. Kill the existing process
3. Start the new server

## Security Considerations

- CORS is fully open (`*`) - restrict in production
- No authentication - meant for local development
- Direct database access - ensure file permissions are correct
- Input validation on all database operations

## Common Issues and Solutions

**Server won't start**: Check if port 3456 is in use with `lsof -Pi :3456`

**Database not found**: Ensure ConPort is initialized in the project with `context_portal/context.db`

**JSON parsing errors**: The editor will show red underlines at error locations

**Slow performance**: Switch from MCP mode to optimized mode using `npm run start:improved`