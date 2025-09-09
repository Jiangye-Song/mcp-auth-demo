# Agent Instructions for MCP Auth Demo

## Project Type
Next.js 15 + Clerk OAuth + MCP Server with authentication

## Key Architecture
- **MCP Endpoint**: `app/api/[transport]/route.ts` (authenticated with Clerk)
- **Authentication**: Clerk OAuth (Google) with `@vercel/mcp-adapter`
- **Tools**: Located in `lib/` directory with Zod schemas
- **Middleware**: Clerk route protection for `/api/mcp` and `/api/sse`
- **OAuth Discovery**: `.well-known/` endpoints for RFC compliance

## Core Patterns

### MCP Tool Creation
1. Define tool in `lib/toolname.ts` with Zod schema
2. Register in `app/api/[transport]/route.ts` using `server.tool()`
3. Extract user data from `authInfo.extra.userId`
4. Use `await clerk.users.getUser(userId)` for user details

### Authentication Flow
- All MCP requests require OAuth tokens
- Use `experimental_withMcpAuth` wrapper
- Verify tokens with `verifyClerkToken`
- Extract user context from Clerk API

### File Structure Requirements
```
app/api/[transport]/route.ts     # Main MCP endpoint
app/.well-known/*/route.ts       # OAuth metadata
lib/*.ts                         # Tool implementations
middleware.ts                    # Route protection
```

## Environment Variables
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

## Testing
- **Web Interface**: `http://localhost:3000` with Google sign-in
- **MCP Protocol**: POST requests to `/api/[transport]` with OAuth headers
- **Dev Server**: `pnpm dev` (uses Turbopack)

## Critical Rules
1. Always authenticate MCP endpoints
2. Use TypeScript strictly
3. Follow Zod schema validation
4. Extract user data from Clerk for personalization
5. Test via web interface when direct MCP calls fail
6. Maintain OAuth RFC compliance in `.well-known/` endpoints