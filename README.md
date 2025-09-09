# MCP Auth Demo

A Next.js 15 application demonstrating Model Context Protocol (MCP) server implementation with Clerk OAuth authentication. This project serves as a reference for building authenticated MCP servers that can be consumed by AI assistants like Claude.

## Architecture Stack

### Core Technologies
- **Next.js 15**: App Router with Turbopack
- **TypeScript**: Type-safe development
- **React 19**: Modern React with concurrent features
- **Tailwind CSS 4**: Utility-first styling
- **Biome**: Code formatting and linting

### Authentication & MCP
- **Clerk**: OAuth authentication provider (Google OAuth configured)
- **@clerk/nextjs**: Clerk's Next.js integration
- **@clerk/mcp-tools**: Clerk-specific MCP authentication helpers
- **@vercel/mcp-adapter**: MCP protocol handler with auth wrappers
- **Zod**: Runtime type validation for MCP tools

## Project Structure

```
├── app/
│   ├── api/
│   │   └── [transport]/
│   │       └── route.ts              # Main authenticated MCP endpoint
│   ├── .well-known/
│   │   ├── oauth-authorization-server/
│   │   │   └── route.ts              # OAuth server metadata
│   │   └── oauth-protected-resource/
│   │       └── mcp/
│   │           └── route.ts          # OAuth resource metadata
│   ├── layout.tsx                    # Root layout with ClerkProvider
│   ├── page.tsx                      # Web interface for testing
│   └── globals.css                   # Global styles
├── lib/
│   └── hello.ts                      # MCP tool implementation
├── middleware.ts                     # Clerk authentication middleware
├── package.json                      # Dependencies and scripts
└── agents.md                         # Agent instructions
```

## Getting Started

### Prerequisites

1. **Node.js 18+** and **pnpm** installed
2. **Clerk Account** with Google OAuth configured
3. **Environment Variables** configured (see below)

### Environment Setup

Create a `.env.local` file with the following variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_secret_here
```

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Clerk Dashboard Configuration

1. **Enable Google OAuth Provider**:
   - Go to your Clerk Dashboard
   - Navigate to "User & Authentication" > "Social Connections"
   - Enable Google and configure with your OAuth credentials

2. **Configure OAuth Settings**:
   - Add `http://localhost:3000` to allowed origins
   - Set up redirect URLs for development and production

## Key Components

### 1. MCP Server (`app/api/[transport]/route.ts`)

The main authenticated MCP endpoint that handles tool calls:

- **Authentication**: Uses `experimental_withMcpAuth` wrapper
- **Token Verification**: Implements `verifyClerkToken` for OAuth validation
- **User Data**: Extracts authenticated user information from Clerk
- **Protocol**: Supports both GET and POST requests for MCP JSON-RPC

### 2. OAuth Metadata Endpoints

**Authorization Server** (`/.well-known/oauth-authorization-server`):
- Provides OAuth server discovery metadata
- Follows RFC 8414 standards

**Protected Resource** (`/.well-known/oauth-protected-resource/mcp`):
- Defines scopes and authentication requirements
- Follows RFC 8707 standards

### 3. Authentication Middleware (`middleware.ts`)

- **Route Protection**: Secures `/api/mcp` and `/api/sse` routes
- **Clerk Integration**: Uses `clerkMiddleware` and `createRouteMatcher`
- **Selective Protection**: Only protects API routes

### 4. MCP Tool Implementation (`lib/hello.ts`)

- **Tool Definition**: Reusable `helloTool` configuration
- **Schema Validation**: Zod-based input validation
- **Authentication Aware**: Supports authenticated users
- **Standardized Output**: Consistent response format

## Adding New MCP Tools

### 1. Create Tool Logic (`lib/your-tool.ts`)

```typescript
import { z } from "zod"

export const yourToolSchema = z.object({
  // Define your parameters
  message: z.string().optional()
})

export function yourToolFunction(params: z.infer<typeof yourToolSchema>) {
  // Implement your tool logic
  return { type: 'text', text: `Processed: ${params.message}` }
}

export const yourTool = {
  name: 'your_tool',
  description: 'Tool description',
  schema: yourToolSchema,
} as const
```

### 2. Register Tool (in `app/api/[transport]/route.ts`)

```typescript
import { yourTool, yourToolFunction } from '@/lib/your-tool'

// Add to the handler
server.tool(
  yourTool.name,
  yourTool.description,
  yourTool.schema,
  async (params, { authInfo }) => {
    const userId = authInfo!.extra!.userId! as string
    const userData = await clerk.users.getUser(userId)
    
    const result = yourToolFunction(params)
    return {
      content: [{ type: 'text', text: result.text }],
    }
  },
)
```

## Testing

### Web Interface Testing

1. Visit `http://localhost:3000`
2. Sign in with Google OAuth
3. Use "Test MCP Auth" button to verify authentication
4. Check that personalized greetings appear

### Direct MCP Protocol Testing

```bash
# Test tools list
curl -X POST http://localhost:3000/api/[transport] \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OAUTH_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Test tool call
curl -X POST http://localhost:3000/api/[transport] \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OAUTH_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say_hello","arguments":{}},"id":1}'
```

### Claude Desktop Integration

1. Configure OAuth in Claude Desktop settings
2. Use discovery endpoints for automatic configuration:
   - Authorization Server: `http://localhost:3000/.well-known/oauth-authorization-server`
   - Protected Resource: `http://localhost:3000/.well-known/oauth-protected-resource/mcp`
3. Test with natural language commands

## Security Considerations

### Authentication Flow

1. **OAuth Token Validation**: All MCP requests must include valid OAuth tokens
2. **User Context**: Tools receive authenticated user information
3. **Route Protection**: Middleware enforces authentication on API routes
4. **CORS Handling**: Proper CORS configuration for OAuth metadata endpoints

### Best Practices

- **Token Expiration**: Handle token refresh in long-running sessions
- **Error Handling**: Graceful degradation for authentication failures
- **Logging**: Implement proper logging for authentication events
- **Rate Limiting**: Consider implementing rate limiting for MCP endpoints

## Deployment

### Environment Configuration

1. Set production environment variables in your hosting platform
2. Configure Clerk production instance
3. Update OAuth redirect URLs for production domain

### Performance Optimization

- Enable Turbopack for faster builds
- Implement proper caching strategies
- Consider CDN for static assets

### Monitoring

- Set up error tracking (Sentry, etc.)
- Monitor authentication success/failure rates
- Track MCP tool usage analytics

## Common Issues & Solutions

### Authentication Issues

- **Token Validation Errors**: Check Clerk configuration and environment variables
- **CORS Errors**: Verify OAuth metadata endpoint configurations
- **Middleware Conflicts**: Ensure proper route matching in middleware

### MCP Protocol Issues

- **Tool Not Found**: Verify tool registration in route handler
- **Schema Validation**: Check Zod schema definitions and parameter types
- **Response Format**: Ensure proper MCP response structure

### Development Issues

- **Hot Reload**: Use Turbopack for faster development iteration
- **Type Errors**: Keep TypeScript strict mode enabled
- **Linting**: Use Biome for consistent code formatting

## Available Scripts

```bash
# Development
pnpm dev          # Start development server with Turbopack

# Production
pnpm build        # Build for production
pnpm start        # Start production server

# Code Quality
pnpm lint         # Run Biome linter
pnpm format       # Format code with Biome

# Testing
pnpm test:mcp     # Test MCP endpoint with curl
```

## Resources

- [Clerk Documentation](https://clerk.com/docs)
- [MCP Protocol Specification](https://modelcontextprotocol.org/)
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Vercel MCP Adapter](https://github.com/vercel/ai/tree/main/packages/mcp-adapter)
- [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)

## Contributing

When contributing to this project:

1. **Always verify authentication** before implementing new features
2. **Follow the established patterns** for tool registration and schema validation
3. **Test both web interface and MCP protocol** for any changes
4. **Maintain OAuth compliance** when modifying authentication flows
5. **Use TypeScript strictly** - no `any` types without justification
6. **Document any new environment variables** or configuration requirements

## License

This project is intended for educational and demonstration purposes.
