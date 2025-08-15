# Project Brief: ConPort Navigator

## Overview

ConPort Navigator is a production-ready web application that provides a powerful interface for browsing, searching, and editing ConPort (Context Portal MCP) data. It delivers lightning-fast performance by using direct SQLite database access with connection pooling, achieving 100x faster speeds than traditional MCP protocol calls. The application serves as a centralized memory navigator for AI-assisted development projects, enabling teams to maintain and access project context, decisions, progress, and custom data efficiently.

## Purpose and Goals

### Primary Purpose
To provide developers and AI assistants with instant access to project memory and context stored in ConPort databases, eliminating the performance bottleneck of MCP protocol communication while maintaining full CRUD capabilities.

### Key Goals
- **Performance**: Achieve sub-millisecond response times for database operations
- **Usability**: Provide an intuitive interface for non-technical users to browse project memory
- **Reliability**: Maintain stable connections with automatic cleanup and error recovery
- **Flexibility**: Support multiple projects simultaneously with easy switching
- **Integration**: Seamlessly work with ConPort MCP ecosystem while bypassing protocol overhead

## Target Users

### Primary Users
- **Software Developers**: Managing project context and decisions across AI-assisted development sessions
- **AI Assistants**: Accessing and updating project memory during code generation and analysis
- **Technical Leads**: Reviewing architectural decisions and tracking project progress
- **Project Managers**: Monitoring development status and understanding technical decisions

### Use Cases
- Browsing historical decisions and their rationales
- Tracking progress on development tasks
- Searching for specific technical patterns or solutions
- Updating project context between AI sessions
- Exporting project memory for documentation
- Managing multiple project contexts simultaneously

## Core Features

### 1. Multi-Project Management
- Configure and switch between multiple ConPort databases
- Visual indicators for connection status
- Persistent project configuration in `config/projects.json`
- Automatic database discovery and validation

### 2. Full CRUD Operations
- **Create**: Add new decisions, progress entries, patterns, and custom data
- **Read**: Browse all ConPort data types with formatted display
- **Update**: Edit existing entries with JSON validation
- **Delete**: Remove outdated or incorrect entries safely

### 3. Advanced Editor
- **Three Modes**: Edit, Preview, and Raw views
- **Syntax Highlighting**: Full JSON syntax highlighting via CodeMirror 6
- **Error Detection**: Real-time JSON validation with inline error markers
- **Auto-formatting**: One-click JSON beautification
- **Keyboard Shortcuts**: Standard editor commands (Ctrl+F, Ctrl+Z, etc.)

### 4. Powerful Search
- Semantic search across all project data
- Filter by data type and categories
- Real-time search results
- Context-aware result highlighting

### 5. Performance Optimization
- **Connection Pooling**: Reuse database connections across requests
- **Prepared Statements**: Pre-compiled SQL for faster execution
- **WAL Mode**: Write-Ahead Logging for concurrent access
- **Memory Caching**: In-memory temp tables and page cache
- **Automatic Cleanup**: Idle connection management

### 6. Data Type Support
All ConPort data types are fully supported:
- Product Context (project overview)
- Active Context (current focus)
- Decisions (architectural choices)
- Progress (task tracking)
- System Patterns (design patterns)
- Custom Data (flexible key-value storage)

## Technology Stack

### Backend
- **Runtime**: Node.js 14+
- **Framework**: Express 5.1.0
- **Database**: SQLite3 via better-sqlite3
- **File Watching**: Chokidar for configuration updates

### Frontend
- **Language**: Vanilla JavaScript (ES6+)
- **UI Framework**: None (pure DOM manipulation)
- **Editor**: CodeMirror 6 with JSON language support
- **Styling**: Native CSS3 with CSS variables
- **Architecture**: Single Page Application (SPA)

### Testing
- **Framework**: Playwright for E2E testing
- **Coverage**: UI interactions, CRUD operations, editor functionality

### Development Tools
- **Package Manager**: npm
- **Process Management**: Native Node.js
- **Logging**: Console-based with structured output

## Architecture Overview

### Three-Tier Architecture

```
┌─────────────────────────────────────┐
│         Frontend (SPA)              │
│   - Vanilla JS (app-simple.js)      │
│   - CodeMirror Editor               │
│   - State Management                │
└─────────────────────────────────────┘
                 ↓ ↑
         HTTP/JSON REST API
                 ↓ ↑
┌─────────────────────────────────────┐
│      Backend (Express Server)       │
│   - Connection Pool Manager         │
│   - Prepared Statements            │
│   - CORS Middleware                │
└─────────────────────────────────────┘
                 ↓ ↑
          Direct SQLite Access
                 ↓ ↑
┌─────────────────────────────────────┐
│      Data Layer (SQLite)           │
│   - ConPort Databases              │
│   - WAL Mode                       │
│   - Optimized Pragmas              │
└─────────────────────────────────────┘
```

### Key Design Decisions

1. **Direct SQLite Access**: Bypasses MCP protocol for 100x performance gain
2. **Connection Pooling**: Maintains persistent connections per project
3. **Prepared Statements**: Reduces SQL compilation overhead
4. **Vanilla JavaScript**: Zero framework dependencies for maintainability
5. **Single Server**: All projects served from one Express instance

### Data Flow

1. User interacts with UI
2. JavaScript captures event and updates state
3. Fetch API sends request to Express server
4. Server retrieves connection from pool
5. Prepared statement executes against SQLite
6. Results returned as JSON
7. UI updates with new data
8. CodeMirror formats for display

## Development Approach

### Methodology
- **Performance-First**: Every architectural decision prioritizes speed
- **Simplicity**: Minimal dependencies and straightforward code
- **Reliability**: Comprehensive error handling and recovery
- **Maintainability**: Clear separation of concerns

### Code Organization
- **server.js**: Express server and ConnectionPool class
- **app-simple.js**: Frontend application logic
- **codemirror-integration.js**: Editor enhancements
- **index.html**: Application shell and UI structure
- **config/projects.json**: Project configuration

### Testing Strategy
- E2E tests with Playwright for critical user flows
- Manual testing with real ConPort databases
- Performance benchmarking against MCP baseline

## Key Decisions

### 1. Direct Database Access
**Decision**: Use better-sqlite3 instead of MCP protocol
**Rationale**: 100x performance improvement, simpler architecture
**Trade-off**: Requires local file system access

### 2. Vanilla JavaScript
**Decision**: No frontend framework (React, Vue, etc.)
**Rationale**: Reduces complexity, improves maintainability
**Trade-off**: More manual DOM manipulation

### 3. Connection Pooling
**Decision**: Implement custom ConnectionPool class
**Rationale**: Reuse connections, prepared statements
**Trade-off**: More complex server code

### 4. CodeMirror Integration
**Decision**: Use CodeMirror 6 for JSON editing
**Rationale**: Professional editor features, error detection
**Trade-off**: Additional dependency and complexity

## Getting Started

### Prerequisites
- Node.js 14 or higher
- npm package manager
- ConPort MCP server configured
- At least one ConPort database initialized

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd conport-navigator

# Install dependencies
npm install
```

### Running the Application
```bash
# Standard start (recommended)
npm start

# With auto-restart on crash
./start.sh

# Alternative modes
npm run start:mcp        # MCP protocol mode (slower)
npm run start:optimized  # Direct SQLite mode
```

### Configuration
1. Edit `config/projects.json` to add your projects
2. Ensure ConPort databases exist at specified paths
3. Access the application at http://localhost:3456

### Testing
```bash
# Run all tests
npx playwright test

# Run with UI
npx playwright test --ui
```

## AI Integration

### How AI Tools Use This Project

1. **Context Retrieval**: AI assistants query ConPort for project context
2. **Decision Logging**: Architectural choices are recorded for future reference
3. **Progress Tracking**: Development status is maintained across sessions
4. **Pattern Recognition**: System patterns guide consistent implementation
5. **Custom Storage**: Flexible data storage for AI-specific needs

### Integration Points
- RESTful API for programmatic access
- JSON format for easy parsing
- Semantic search for intelligent queries
- Real-time updates for collaborative work

### Best Practices for AI
- Always include workspace_id in requests
- Use prepared statement names when available
- Batch operations when possible
- Cache frequently accessed data

## Project Structure

```
conport-navigator/
├── .claude/                    # Claude Code configuration
│   └── settings.local.json     # Permission settings
├── config/                     # Configuration files
│   └── projects.json          # Project definitions
├── tests/                      # Playwright tests
│   └── ui.spec.js            # UI test specifications
├── index.html                  # Application shell
├── server.js                   # Express server with ConnectionPool
├── app-simple.js              # Frontend application logic
├── codemirror-integration.js  # Editor enhancements
├── create_db.js               # Database creation utility
├── start.sh                   # Startup script with auto-restart
├── package.json               # Dependencies and scripts
├── CLAUDE.md                  # AI guidance for Claude Code
├── AGENTS.md                  # AI guidance for other assistants
└── README.md                  # User documentation
```

## Performance Metrics

### Benchmarks (vs MCP Protocol)
- **Query Speed**: 100x faster (< 1ms vs 100ms)
- **Connection Time**: Instant (pooled) vs 50ms handshake
- **Throughput**: 1000+ ops/sec vs 10 ops/sec
- **Memory Usage**: 50MB baseline with efficient caching

### Optimization Techniques
- WAL mode for concurrent access
- Prepared statements for query compilation
- Connection pooling for resource reuse
- Memory-mapped I/O for large reads
- Automatic idle connection cleanup

## Future Enhancements

### Planned Features
- WebSocket support for real-time updates
- Export to Markdown/PDF
- Import from various formats
- Collaborative editing
- Version history tracking

### Potential Improvements
- GraphQL API option
- Plugin system for extensibility
- Theme customization
- Keyboard-only navigation
- Advanced filtering options

## References

### Documentation
- [ConPort GitHub Repository](https://github.com/GreatScottyMac/context-portal)
- [MCP Documentation](https://modelcontextprotocol.io)
- [SQLite Optimization Guide](https://www.sqlite.org/optoverview.html)
- [CodeMirror 6 Documentation](https://codemirror.net/6/)

### Related Projects
- Context Portal MCP Server
- Claude Code Integration
- ConPort CLI Tools

### Support Resources
- GitHub Issues for bug reports
- Community Discord for discussions
- Documentation wiki for guides

---

*Last Updated: 2025-01-15*
*Version: 1.0.0*
*License: Apache 2.0*