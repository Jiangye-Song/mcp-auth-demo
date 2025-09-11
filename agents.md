# Agent Instructions for MCP Hello Demo

## Project Type
Next.js 15 + Simple MCP Server without authentication

## Key Architecture
- **MCP Endpoint**: `app/api/[transport]/route.ts` (no authentication required)
- **Tools**: Located in `lib/` directory with Zod schemas
- **Simple Setup**: Based on roll dice MCP server architecture

## Core Patterns

### MCP Tool Creation
1. Define tool in `lib/toolname.ts` with Zod schema
2. Register in `app/api/[transport]/route.ts` using `createMcpHandler()`
3. No authentication - direct tool execution

### Simple MCP Flow
- All MCP requests are processed without authentication
- Use `createMcpHandler` from `mcp-handler` package
- Tools are registered with server.tool() method

### File Structure Requirements
```
app/api/[transport]/route.ts     # Main MCP endpoint
lib/*.ts                         # Tool implementations
app/actions/mcp-actions.ts       # Server actions for web testing
```

## Environment Variables
None required - no authentication

## Testing
- **Web Interface**: `http://localhost:3000` (if implemented)
- **MCP Protocol**: POST requests to `/api/mcp` without auth headers
- **Dev Server**: `pnpm dev` (uses Turbopack)

## Critical Rules
1. No authentication required for MCP endpoints
2. Use TypeScript strictly
3. Follow Zod schema validation
4. Use simple `createMcpHandler` pattern
5. Test via direct MCP calls or web interface
6. Based on roll dice server architecture (simple and clean)
7. Always use pnpm
8. Dev on 3000, if 3000 occupied, kill server on 3000
9. Use PowerShell command instead of curl