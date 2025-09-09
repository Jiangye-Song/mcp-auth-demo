# MCP Hello Demo with Google OAuth

A Model Context Protocol (MCP) server built with **Next.js 15** and **mcp-handler**, featuring **Google OAuth 2.0 authentication**.

## 🎯 Status: WORKING ✅

This project successfully implements:
- ✅ **Google OAuth Authentication** - Full OAuth 2.0 flow with dual token support
- ✅ **VS Code MCP Integration** - Seamless authentication with VS Code
- ✅ **RFC 9728 Compliance** - OAuth Protected Resource Metadata standard
- ✅ **Dual Token Verification** - Handles both Google ID tokens and access tokens

## 🔧 The Key Breakthrough

**Problem**: VS Code was sending Google **access tokens** instead of **ID tokens**.

**Solution**: Implemented **dual token verification** that automatically detects and handles both token types:
- **Google ID Tokens** (JWTs) → Verified with `google-auth-library`
- **Google Access Tokens** → Verified with Google UserInfo API

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

2. **Restart VS Code** - MCP server will auto-start with OAuth authentication

## 🏗️ Architecture

### Core Components
- **`app/api/[transport]/route.ts`** - Main MCP endpoint with OAuth authentication
- **`lib/auth.ts`** - Dual token verification (ID tokens + access tokens)
- **`app/.well-known/oauth-protected-resource/route.ts`** - RFC 9728 metadata endpoint
- **`lib/hello.ts`** - Authenticated MCP tool implementation

### Authentication Flow
1. **OAuth Metadata Discovery** - VS Code fetches `/.well-known/oauth-protected-resource`
2. **Google OAuth** - User authenticates via Google OAuth 2.0
3. **Token Verification** - Server verifies both ID tokens and access tokens
4. **Authenticated MCP Calls** - Tools execute with user context

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
- ✅ **Token Verification** - Both Google ID tokens and access tokens
- ✅ **User Context** - Tools receive authenticated user information
- ✅ **Error Handling** - Proper 401/403 responses with WWW-Authenticate headers
- ✅ **Scope Validation** - Configurable OAuth scope requirements
- ✅ **Stateless** - No session storage, tokens verified per request

### Google Cloud Console Setup
**OAuth 2.0 Configuration**:
- **Authorized Redirect URIs**: `http://localhost:3000/api/auth/callback/google`
- **Authorized JavaScript Origins**: `http://localhost:3000`
- **Application Type**: Web application

## 🧪 Testing

### Manual Testing
```bash
# Test authentication with real Google token
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ya29.a0AS3H6N..." \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"say_hello","arguments":{"name":"Test"}}}'
```

### Expected Success Log
```
Access token verified successfully for user: songjiangye2021@gmail.com
```

## 📖 Documentation

- **[OAuth Implementation Plan](./OAUTH_IMPLEMENTATION_PLAN.md)** - Complete implementation guide
- **[Agent Instructions](./agents.md)** - Development patterns and architecture

## 🎯 Key Learnings

1. **Flexible Token Handling** - Support multiple Google OAuth token types
2. **Google UserInfo API** - Reliable verification for access tokens
3. **RFC 9728 Compliance** - Essential for MCP client compatibility
4. **Real-world Testing** - VS Code behavior differs from curl testing
5. **Robust Error Handling** - Clear debugging and graceful failures

## 🚀 Production Deployment

This implementation is **production-ready** with:
- Proper error handling and security
- Stateless authentication (no database required)
- Horizontal scaling support
- Comprehensive logging for debugging

Perfect for building authenticated MCP servers that integrate with VS Code and other MCP clients.

---

**Built with ❤️ using mcp-handler and Next.js 15**
