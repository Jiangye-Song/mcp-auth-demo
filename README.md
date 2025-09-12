# MCP Hello Demo with Google OAuth

A Model Context Protocol (MCP) server built with **Next.js 15** and **mcp-handler**, featuring **Google OAuth 2.1 authentication**.

## 🎯 Status: PRODUCTION READY ✅

This project successfully implements:
- ✅ **Google OAuth 2.1 Authentication** - Full OAuth 2.1 flow with PKCE support
- ✅ **VS Code MCP Integration** - Seamless authentication with VS Code
- ✅ **MCP Remote Support** - Compatible with `npx mcp-remote` tool
- ✅ **RFC 9728 Compliance** - OAuth Protected Resource Metadata standard
- ✅ **Dual Client Support** - Works with both VS Code and MCP Remote clients

## 🔧 Key Features

**OAuth 2.1 Compliance**: Modern OAuth implementation with:
- **PKCE (Proof Key for Code Exchange)** - Enhanced security for public clients
- **Authorization Code Flow** - Secure token exchange
- **Auto-discovery Endpoints** - RFC-compliant `.well-known` metadata

**Dual Client Support**: Works seamlessly with:
- **VS Code MCP Extension** - Interactive authentication with browser OAuth flow
- **MCP Remote Tool** - Command-line MCP client with automated OAuth handling

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google Cloud Console project with OAuth 2.0 credentials

### Setup
1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure Google OAuth** (`.env.local`):
   ```env
   GOOGLE_CLIENT_ID=228760319328-g2tmjubea6q0ftpuuab6p23647eht53.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=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
   ```
   Note: this GOOGLE_CLIENT_SECRET is already deleted from the Google Console.

3. **Start development server**:
   ```bash
   pnpm dev
   ```

### VS Code Integration
1. **Configure MCP** (`.vscode/mcp.json`):
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

2. **Start MCP Server** - In VS Code, click the **Start** button for the MCP server. VS Code will prompt you to complete OAuth verification in your browser.

### MCP Remote Testing
```bash
# Test with mcp-remote (automatically handles OAuth flow)
npx mcp-remote http://localhost:3000/api/mcp
```
This will open your browser for Google OAuth authentication, then establish the MCP connection.

## 🏗️ Architecture

### Core Components
- **`app/api/[transport]/route.ts`** - Main MCP endpoint with OAuth 2.1 authentication
- **`lib/auth.ts`** - Google OAuth token verification
- **`app/.well-known/oauth-authorization-server/route.ts`** - OAuth 2.1 authorization server metadata
- **`app/.well-known/oauth-protected-resource/route.ts`** - OAuth 2.1 protected resource metadata
- **`app/api/auth/authorize/route.ts`** - OAuth 2.1 authorization endpoint
- **`app/api/auth/token/route.ts`** - OAuth 2.1 token endpoint
- **`app/oauth/callback/route.ts`** - OAuth callback for MCP Remote clients
- **`lib/hello.ts`** - Authenticated MCP tool implementation

### Authentication Flow
1. **OAuth Discovery** - Clients fetch `.well-known` metadata endpoints
2. **Authorization Request** - Redirect to `/api/auth/authorize` with PKCE
3. **Google OAuth** - User authenticates via Google OAuth 2.0
4. **Token Exchange** - Authorization code exchanged for tokens at `/api/auth/token`
5. **Authenticated MCP Calls** - Tools execute with verified user context

## 🛠️ Available Tools

### `say_hello`
Greets users with authentication context.

**Usage**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 1,
  "params": {
    "name": "say_hello",
    "arguments": { "name": "World" }
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "👋 Hello, World! (authenticated as user@gmail.com) This is an authenticated MCP tool!"
    }]
  }
}
```

## 📚 Technical Details

### Dependencies
- **`mcp-handler`** - Official MCP server framework with OAuth support
- **`google-auth-library`** - Google token verification
- **`next`** - React framework for the server application
- **`zod`** - Schema validation for tool parameters

### Security Features
- ✅ **OAuth 2.1 Compliance** - Modern OAuth with PKCE and strict security
- ✅ **Google ID Token Verification** - Cryptographic token validation
- ✅ **User Context** - Tools receive authenticated user information
- ✅ **Error Handling** - Proper 401/403 responses with WWW-Authenticate headers
- ✅ **Multi-Client Support** - Works with VS Code and MCP Remote
- ✅ **Stateless** - No session storage, tokens verified per request

### Google Cloud Console Setup
**OAuth 2.0 Configuration**:
- **Authorized Redirect URIs**: 
  - `http://localhost:3000/api/auth/callback/google`
  - `http://localhost:3000/oauth/callback`
- **Authorized JavaScript Origins**: `http://localhost:3000`
- **Application Type**: Web application

## 🧪 Testing

### Manual Testing with MCP Remote
```bash
# Test with mcp-remote (handles full OAuth flow automatically)
npx mcp-remote http://localhost:3000/api/mcp

# This will:
# 1. Open browser for Google OAuth authentication
# 2. Complete OAuth 2.1 flow with PKCE
# 3. Establish authenticated MCP connection
# 4. Allow you to call tools interactively
```

### Manual HTTP Testing (requires valid Google ID token)
```bash
# Test authentication with real Google ID token
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6..." \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"say_hello","arguments":{"name":"Test"}}}'
```

### Expected Success Log
```
✅ Google ID token verified successfully
User info: {
  clientId: '228760319328-g2tmjubea6q0ftpuuuab6p23647eht53.apps.googleusercontent.com',
  scopes: ['openid', 'email', 'profile'],
  email: 'user@gmail.com',
  provider: 'google'
}
```

## 📖 Documentation

- **[Agent Instructions](./agents.md)** - Development patterns and architecture guidelines

## 🎯 Key Learnings

1. **OAuth 2.1 + PKCE** - Enhanced security for MCP client authentication
2. **Dual Client Support** - Single server works with VS Code and MCP Remote
3. **Auto-discovery** - RFC-compliant `.well-known` endpoints for client detection
4. **User-initiated Flow** - VS Code requires clicking Start button, not auto-restart
5. **Production Architecture** - Stateless, scalable OAuth 2.1 implementation

## 🚀 Production Deployment

This implementation is **production-ready** with:
- Proper error handling and security
- Stateless authentication (no database required)
- Horizontal scaling support
- Comprehensive logging for debugging

Perfect for building authenticated MCP servers that integrate with VS Code and other MCP clients.

---

**Built with ❤️ using mcp-handler and Next.js 15**
