# MCP Authentication Demo

A production-ready **Model Context Protocol (MCP)** server with **OAuth 2.1 authentication** built using Next.js 15 and Google OAuth.

## 🎯 Status: Production Ready ✅

**OAuth 2.1 Compliant** - Fully implements OAuth 2.1 authorization code flow with PKCE, removing deprecated implicit flow patterns.

### Key Features
- ✅ **OAuth 2.1 Authentication** - Secure Google OAuth with PKCE support
- ✅ **VS Code Integration** - Seamless MCP authentication in VS Code
- ✅ **MCP Remote Support** - Full compatibility with mcp-remote for both local and remote servers
- ✅ **Security First** - No token exposure in URLs, proper error handling
- ✅ **Standards Compliant** - RFC 9728 OAuth Protected Resource Metadata

## 📋 Important Notice: mcp-remote Compatibility

> **💡 TIP**: When using `mcp-remote` with remote servers, specify a unique port number (e.g., 59908) to avoid conflicts with other MCP servers. This server has been designed to handle both local and remote OAuth flows seamlessly.
>
> **Technical Background**: This server resolves an architectural limitation in `mcp-remote`'s port detection by implementing intelligent redirect URI management that supports both OAuth 2.1 compliance and client compatibility requirements.
>
> **Usage Examples**:
> ```bash
> # Local development (no port needed)
> npx mcp-remote http://localhost:3000/api/mcp
> 
> # Remote server (specify unique port)
> npx mcp-remote https://your-server.vercel.app/api/mcp 59908
> ```

See detailed analysis: [mcp-remote Port Detection Issue Analysis](./docs/mcp-remote-port-detection-issue.md)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google OAuth 2.0 credentials ([Setup Guide](https://developers.google.com/identity/protocols/oauth2))

### Installation
```bash
# Clone and install
git clone <repository-url>
cd mcp-auth-demo
pnpm install
```

### Configuration
Create `.env.local`:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Development
```bash
pnpm dev
# Server runs at http://localhost:3000
```

## 🔧 Usage

### VS Code Integration
1. **Configure MCP** in `.vscode/mcp.json`:
   ```json
   {
     "servers": {
       "hello-mcp": {
         "type": "http",
         "url": "http://localhost:3000/api/mcp"
       }
     }
   }
   ```

2. **Start MCP Server** in VS Code - Click the "Start" button and complete OAuth in browser

### Command Line Testing
```bash
# Test with mcp-remote (handles OAuth automatically)
npx mcp-remote http://localhost:3000/api/mcp

# Works with remote servers too! (including Vercel deployments)
npx mcp-remote https://mcp-auth-demo-rust.vercel.app/api/mcp
```

## 📁 Project Structure

### Core Application Files

#### **`app/api/[transport]/route.ts`**
Main MCP endpoint with OAuth 2.1 authentication middleware. Handles all MCP protocol messages with bearer token validation.

#### **`lib/auth.ts`**
OAuth 2.1 authentication utilities:
- Google ID token verification
- User context extraction
- Token validation functions

#### **`lib/hello.ts`**
MCP tool implementation with authentication context. Demonstrates how to build authenticated MCP tools.

### OAuth 2.1 Authentication System

#### **`app/api/auth/authorize/route.ts`**
OAuth 2.1 authorization endpoint with PKCE support. Initiates the authentication flow and redirects to Google OAuth.

#### **`app/api/auth/token/route.ts`**
OAuth 2.1 token endpoint for authorization code exchange. Handles PKCE verification and issues tokens.

#### **`app/api/auth/callback/google/route.ts`**
Google OAuth callback handler with client type detection:
- VS Code Local (authorization code flow)
- VS Code Web (protocol-specific parameters)
- MCP Remote (oauth/callback pattern)

#### **`app/api/auth/register/route.ts`**
OAuth 2.0 Dynamic Client Registration endpoint (RFC 7591) with **mcp-remote compatibility fix**. Includes both server-domain and localhost redirect URIs to support mcp-remote's port detection mechanism while maintaining OAuth 2.1 compliance.

### OAuth Discovery Endpoints

#### **`app/.well-known/oauth-authorization-server/route.ts`**
OAuth 2.1 Authorization Server Metadata (RFC 8414). Provides client discovery information for OAuth capabilities.

#### **`app/.well-known/oauth-protected-resource/route.ts`**
OAuth 2.1 Protected Resource Metadata (RFC 9728). Enables MCP clients to discover authentication requirements.

### Additional Routes

#### **`app/oauth/callback/route.ts`**
OAuth callback specifically for MCP Remote and Claude Desktop clients using the `/oauth/callback` pattern.

#### **`app/actions/mcp-actions.ts`**
Server actions for Next.js frontend to interact with MCP server (demo purposes).

### Frontend Components

#### **`app/layout.tsx`**
Next.js root layout with metadata and font configuration.

#### **`app/page.tsx`**
Demo homepage with MCP server information and integration examples.

#### **`app/globals.css`**
Global CSS styles using Tailwind CSS.

### Configuration Files

#### **`package.json`**
Project dependencies and scripts:
- `mcp-handler` - Official MCP server framework
- `google-auth-library` - Google OAuth token verification
- `next` - React framework
- `zod` - Schema validation

#### **`next.config.ts`**
Next.js configuration for the MCP server application.

#### **`tsconfig.json`**
TypeScript configuration with strict type checking.

#### **`biome.json`**
Code formatting and linting configuration using Biome.

#### **`postcss.config.mjs`**
PostCSS configuration for Tailwind CSS processing.

#### **`.vscode/mcp.json`**
VS Code MCP extension configuration for local development.

#### **`.gitignore`**
Git ignore patterns for Node.js, Next.js, and development files.

### Test Files

#### **`test-vscode-oauth.html`**
OAuth 2.1 testing utility for debugging authentication flows. Validates query parameter patterns and compliance.

### Documentation

#### **`docs/authentication-url-patterns.md`**
Detailed analysis of OAuth URL patterns and authentication flows. [View Documentation](./docs/authentication-url-patterns.md)

#### **`docs/oauth-2.1-compliance-plan.md`**
Complete implementation plan for OAuth 2.1 compliance, including removal of deprecated patterns. [View Plan](./docs/oauth-2.1-compliance-plan.md)

#### **`agents.md`**
Development guidelines and architectural patterns for building MCP servers. [View Guidelines](./agents.md)

## 🛠️ Available MCP Tools

### `say_hello`
Authenticated greeting tool that returns user context.

**Parameters:**
- `name` (string, optional): Name to greet (default: "World")

**Example:**
```bash
# Via mcp-remote
npx mcp-remote http://localhost:3000/api/mcp
> call say_hello {"name": "Alice"}
```

**Response:**
```
👋 Hello, Alice! (authenticated as user@gmail.com) This is an authenticated MCP tool!
```

## 🔒 Security Features

- **OAuth 2.1 Compliance** - Modern OAuth with mandatory PKCE
- **No Token Exposure** - Authorization code flow prevents URL token leakage
- **Google ID Token Verification** - Cryptographic signature validation
- **Client Type Detection** - Automatic detection and appropriate flow selection
- **Proper Error Handling** - OAuth 2.1 compliant error responses
- **Stateless Architecture** - No session storage, scales horizontally

## 📖 Related Documentation

- **[Authentication URL Patterns](./docs/authentication-url-patterns.md)** - Deep dive into OAuth flow patterns
- **[OAuth 2.1 Compliance Plan](./docs/oauth-2.1-compliance-plan.md)** - Implementation strategy and security improvements
- **[Development Guidelines](./agents.md)** - Best practices for MCP server development

## 🧪 Testing

### Automated OAuth Flow
```bash
# Complete OAuth flow with browser authentication
npx mcp-remote http://localhost:3000/api/mcp
```

### Manual HTTP Testing (requires valid token)
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer <google-id-token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"say_hello","arguments":{"name":"Test"}}}'
```

### Development Tools
- **MCP Remote**: Command-line MCP client with automatic OAuth handling
- **VS Code Extension**: Interactive MCP development environment

## 🚀 Deployment

This implementation is production-ready with:
- Stateless authentication (no database required)
- Horizontal scaling support
- Comprehensive error handling
- Security best practices
- OAuth 2.1 compliance

### Environment Variables
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
# Optional: Custom domain override (auto-detected in most cases)
CUSTOM_DOMAIN=your-custom-domain.com
```

**Note**: URLs are automatically resolved using the intelligent url-resolver system that detects the appropriate domain based on environment (Vercel, localhost, etc.).

### Google OAuth Setup
**Authorized Redirect URIs:**
- `https://your-domain.com/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google` (development)

---

**Built with ❤️ using Next.js 15, mcp-handler, and OAuth 2.1**