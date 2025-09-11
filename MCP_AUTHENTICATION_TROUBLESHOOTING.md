# MCP OAuth 2.1 Authentication Troubleshooting Guide

## � OAuth 2.0 vs 2.1 Compatibility Analysis

### ✅ Backward Compatibility Assessment

**OAuth 2.1 is largely backward compatible with OAuth 2.0.** The main differences are:

| Feature | OAuth 2.0 | OAuth 2.1 | Our Implementation | Compatibility |
|---------|-----------|-----------|-------------------|---------------|
| **PKCE** | Optional | **Mandatory** | ✅ Implemented (S256) | ✅ Compatible |
| **Authorization Code Flow** | Supported | **Only flow allowed** | ✅ Using this flow | ✅ Compatible |
| **Implicit Flow** | Allowed | **Removed** | ❌ Not using | ✅ Compatible |
| **Resource Owner Password** | Allowed | **Removed** | ❌ Not using | ✅ Compatible |
| **Bearer Tokens** | RFC 6750 | **Same** | ✅ Implemented | ✅ Compatible |
| **Redirect URI Validation** | Relaxed | **Exact match required** | ✅ Exact matching | ✅ Compatible |
| **State Parameter** | Recommended | **Required** | ✅ Using state | ✅ Compatible |

### 📋 Implementation Strategy: Dual Compatibility

**We can support both OAuth 2.0 and 2.1** by implementing OAuth 2.1 requirements, which automatically provides OAuth 2.0 compatibility:

```typescript
// OAuth 2.1 compliant metadata (also OAuth 2.0 compatible)
const authServerMetadata = {
  issuer: baseUrl,
  authorization_endpoint: `${baseUrl}/api/auth/authorize`,
  token_endpoint: `${baseUrl}/api/auth/token`,
  
  // OAuth 2.1 requirements (backward compatible)
  response_types_supported: ['code'], // Only authorization code flow
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'], // PKCE mandatory
  
  // OAuth 2.0 compatibility
  token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
  
  // MCP 2025-06-18 additions
  resource_indicator_supported: true, // RFC 8707
  protected_resource_metadata_endpoint: `${baseUrl}/.well-known/oauth-protected-resource`
};
```

## � VS Code Token Usage Failure Analysis

### ✅ OAuth Flow Working Perfectly

From the terminal logs, **OAuth flow is 100% successful**:

1. **Authorization Server Discovery**: ✅ Working
   ```
   GET /.well-known/oauth-authorization-server 200 in 583ms
   ```

2. **Protected Resource Metadata**: ✅ Working
   ```
   GET /.well-known/oauth-protected-resource 200 in 756ms
   ```

3. **Token Exchange Success**: ✅ Working
   ```
   Token exchange successful, received: ['access_token', 'expires_in', 'refresh_token', 'scope', 'token_type', 'id_token']
   ID token present: true
   Access token present: true
   ```

4. **Token Delivery to VS Code**: ✅ Working
   ```
   Final vscode-local redirect URL: http://127.0.0.1:33418/#access_token=[ID_TOKEN_MASKED]&token_type=Bearer&expires_in=3599
   ```

### ❌ VS Code Token Usage Complete Failure

**The problem occurs AFTER successful OAuth flow:**

```
=== ENHANCED TOKEN VERIFICATION ===
Bearer token provided: false
Token length: 0
❌ No bearer token found after all checks
POST /api/mcp 401 in 4947ms
```

**Critical Issue**: VS Code MCP client **receives tokens successfully** but **never includes them** in Authorization headers when making requests to `/api/mcp`.

**BREAKING CHANGES**: The MCP specification has been updated to **OAuth 2.1** with comprehensive authorization requirements. Our implementation must be updated to comply with:

### New MCP OAuth 2.1 Requirements (Specification 2025-06-18)
- **OAuth 2.1 Compliance**: Must implement OAuth 2.1 (draft-ietf-oauth-v2-1-13) instead of OAuth 2.0
- **Resource Indicators (RFC 8707)**: MUST include `resource` parameter in authorization/token requests
- **PKCE Mandatory**: MUST implement PKCE for authorization code protection
- **Protected Resource Metadata (RFC 9728)**: MUST implement for authorization server discovery
- **Authorization Server Metadata (RFC 8414)**: MUST provide OAuth discovery endpoints
- **Dynamic Client Registration (RFC 7591)**: SHOULD support automatic client registration
- **Bearer Token Authentication**: MUST use `Authorization: Bearer <token>` header format
- **Token Audience Validation**: MUST validate tokens are issued specifically for this MCP server
- **HTTPS Required**: All authorization endpoints MUST use HTTPS

## 🏗️ Claude Desktop Architecture with MCP Remote

Based on OAuth 2.1 implementations from production MCP servers and Claude Desktop's use of MCP Remote proxy:

## 🏗️ Claude Desktop Architecture with MCP Remote

**CRITICAL INSIGHT**: Claude Desktop currently uses `mcp-remote` as a proxy for OAuth-enabled MCP servers.

### Claude Desktop → MCP Remote → Your MCP Server Flow

```
Claude Desktop (stdio) ←→ mcp-remote (OAuth proxy) ←→ Your MCP Server (OAuth)
```

**Configuration in `claude_desktop_config.json`**:
```json
{
  "mcpServers": {
    "your-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-mcp-server.com/api/mcp"
      ]
    }
  }
}
```

### MCP Remote OAuth Implementation Patterns

- **Callback Server**: Creates local OAuth callback server on random port (default 3334)
- **Client Detection**: Uses redirect URI patterns to detect VS Code vs Claude vs generic clients
- **Token Storage**: Stores OAuth tokens in `~/.mcp-auth/{server_hash}/` directory
- **Multi-Transport**: Supports both SSE and HTTP transports with fallback
- **PKCE Support**: Implements PKCE S256 for enhanced OAuth security

1. **OAuth Flow Works Perfectly**: 
   - ✅ Server responds to `/.well-known/oauth-protected-resource`
   - ✅ Authorization server metadata is served
   - ✅ User authentication with Google completes successfully
   - ✅ Tokens are exchanged and returned successfully
   - ✅ **NEW**: Token callback is properly detected and handled

2. **OAuth Callback Issue Identified**:
   - ✅ **NEW**: Local test redirect (`http://127.0.0.1:33418/`) is detected as `local-test` client
   - ✅ **NEW**: Server correctly returns JSON response with token preview
   - ❌ **PROBLEM**: VS Code expects to be redirected to a URL with token fragments, not receive JSON
   - ❌ **RESULT**: VS Code doesn't capture the token because it's not in the expected format/location

3. **Token Usage Still Fails**:
   - ❌ VS Code makes MCP requests **without** the `Authorization` header
   - ❌ Server logs show: `Bearer token provided: false`
   - ❌ Request headers contain no `Authorization` field
   - ❌ Results in 401 error: `{"error":"invalid_token","error_description":"No authorization provided"}`

### Root Cause - UPDATED

**VS Code expects OAuth tokens to be delivered via URL redirect with fragments**, not via JSON response. The current implementation detects the local redirect URI (`http://127.0.0.1:33418/`) as a test client and returns JSON, but VS Code's OAuth client is actually waiting for a redirect to that URL with the token in the URL fragment.

## 🔍 Latest Log Analysis

### OAuth Callback Success Evidence - NEW
```
OAuth callback received:
Code: present
State: {"originalState":"Qr3JvvyB7e4BPYkef4quQw==","originalRedirectUri":"http://127.0.0.1:33418/"}
Client details: { type: 'local-test', originalRedirectUri: 'http://127.0.0.1:33418/', originalState: 'Qr3JvvyB7e4BPYkef4quQw==' }
Local test client detected - returning success response instead of redirect
```

### JSON Response Instead of Redirect - NEW
```json
{
  "success": true,
  "message": "OAuth authentication successful", 
  "token_preview": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjljNjI1MTU4Nzk1MDg0NG...",
  "user_info": "Token can be used for MCP authentication",
  "next_steps": "Use this token in Authorization header for MCP requests"
}
```

### VS Code Still Can't Get Token - CONFIRMED
```
2025-09-11 23:20:57.135 [warning] Error getting token from server metadata: Canceled: Canceled
2025-09-11 23:20:57.135 [info] Connection state: Error 401 status sending message to http://localhost:3000/api/mcp: {"error":"invalid_token","error_description":"No authorization provided"}
```

## 🛠️ OAuth 2.1 Solution Options - MCP Specification 2025-06-18 Compliant

### Option 1: MCP 2025-06-18 Compliant OAuth 2.1 Server (REQUIRED)

**Pattern**: Implement OAuth 2.1 server following MCP specification 2025-06-18 requirements

```typescript
// MCP 2025-06-18 requires these OAuth 2.1 endpoints:
// GET /.well-known/oauth-protected-resource - Protected resource metadata (REQUIRED)
// GET /.well-known/oauth-authorization-server - Authorization server metadata (REQUIRED) 
// POST /oauth/register - Dynamic client registration (RECOMMENDED)
// GET /oauth/authorize - Authorization code flow with PKCE (REQUIRED)
// POST /oauth/token - Token exchange with resource parameter (REQUIRED)
// GET /oauth/callback - Callback handling

// OAuth 2.1 discovery metadata (MCP 2025-06-18 compliant)
export async function GET(request: Request) {
  const baseUrl = process.env.OAUTH_ISSUER || new URL(request.url).origin;
  
  return Response.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/api/auth/token`,
    registration_endpoint: `${baseUrl}/api/auth/register`,
    response_types_supported: ['code'], // OAuth 2.1 recommendation
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'], // PKCE required by MCP
    token_endpoint_auth_methods_supported: ['none'], // Public client support
    scopes_supported: ['openid', 'profile', 'email'],
    
    // MCP 2025-06-18 required fields
    resource_indicator_supported: true, // RFC 8707 support
    require_pushed_authorization_requests: false,
    pushed_authorization_request_endpoint: null,
    revocation_endpoint: `${baseUrl}/api/auth/revoke`,
    introspection_endpoint: `${baseUrl}/api/auth/introspect`
  });
}

// Protected Resource Metadata (MCP 2025-06-18 REQUIRED)
// GET /.well-known/oauth-protected-resource
export async function getProtectedResourceMetadata(request: Request) {
  const baseUrl = new URL(request.url).origin;
  
  return Response.json({
    resource: baseUrl, // Canonical MCP server URI
    authorization_servers: [
      `${baseUrl}/.well-known/oauth-authorization-server`
    ],
    scopes_supported: ['mcp:read', 'mcp:write', 'mcp:tools'],
    bearer_methods_supported: ['header'], // Authorization: Bearer <token>
    resource_documentation: `${baseUrl}/docs/api`
  });
}

// MCP Remote client metadata (matches production patterns)
const mcpRemoteClientMetadata = {
  redirect_uris: [`http://127.0.0.1:${callbackPort}/oauth/callback`],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  client_name: 'MCP CLI Client',
  client_uri: 'https://github.com/modelcontextprotocol/mcp-cli',
  software_id: '2e6dc280-f3c3-4e01-99a7-8181dbd1d23d',
  software_version: 'mcp-remote-version'
};
```

**Benefits**: Full MCP Remote compatibility, proper OAuth 2.0 compliance, PKCE security

### Option 2: Direct OAuth with MCP Remote Bypass (ADVANCED)

**Pattern**: Configure Claude Desktop to use MCP Remote with custom headers to bypass OAuth

```json
// claude_desktop_config.json - Bypass OAuth with custom headers
{
  "mcpServers": {
    "your-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-mcp-server.com/api/mcp",
        "--header",
        "Authorization:Bearer ${MCP_TOKEN}"
      ],
      "env": {
        "MCP_TOKEN": "your-static-token-here"
      }
    }
  }
}
```

**Benefits**: Simpler implementation, bypasses OAuth complexity, works immediately

### Option 3: Fix Current Implementation for MCP Remote (IMMEDIATE)

**This addresses the root cause for MCP Remote compatibility.** The main issue is that our OAuth server needs to be compatible with MCP Remote's OAuth client expectations.

#### 1.1 Implement OAuth Discovery Metadata ✅ REQUIRED FOR MCP REMOTE

**Problem**: MCP Remote requires OAuth discovery metadata to initialize OAuth flow.

**Solution**: Add OAuth discovery endpoint that MCP Remote expects:

```typescript
// app/api/.well-known/oauth-authorization-server/route.ts
export async function GET(request: Request) {
  const baseUrl = process.env.OAUTH_ISSUER || new URL(request.url).origin;
  
  return Response.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,
    token_endpoint: `${baseUrl}/api/auth/token`,
    registration_endpoint: `${baseUrl}/api/auth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['openid', 'profile', 'email']
  });
}
```

#### 1.2 Handle MCP Remote Client Registration ✅ OPTIONAL BUT RECOMMENDED

**Problem**: MCP Remote attempts dynamic client registration if no static client info provided.

**Solution**: Support dynamic client registration or provide static client configuration:

```typescript
// MCP Remote client registration pattern
export async function POST(request: Request) {
  const clientMetadata = await request.json();
  
  // Generate client ID for MCP Remote
  const clientId = `mcp-remote-${Date.now()}`;
  
  // Store client registration (in production, use database)
  const clientInfo = {
    client_id: clientId,
    client_secret: null, // Public client
    redirect_uris: clientMetadata.redirect_uris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none'
  };
  
  return Response.json(clientInfo);
}
```

#### 1.3 MCP Remote PKCE Verification ✅ REQUIRED

**Problem**: MCP Remote uses PKCE S256 for OAuth security.

**Solution**: Implement PKCE verification in token endpoint:

```typescript
// PKCE verification with resource parameter (MCP 2025-06-18 requirement)
export function verifyPKCE(codeChallenge: string, codeVerifier: string): boolean {
  const hash = crypto.createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return codeChallenge === hash;
}

// Validate resource parameter (RFC 8707 - MCP 2025-06-18 REQUIRED)
export function validateResourceParameter(resource: string, serverBaseUrl: string): boolean {
  try {
    const resourceUrl = new URL(resource);
    const serverUrl = new URL(serverBaseUrl);
    
    // Must match server's canonical URI
    return resourceUrl.origin === serverUrl.origin && 
           resourceUrl.pathname === serverUrl.pathname;
  } catch {
    return false;
  }
}

// Token endpoint with MCP 2025-06-18 compliance
export async function POST(request: Request) {
  const { code, code_verifier, client_id, resource } = await request.json();
  
  // Validate resource parameter (REQUIRED by MCP 2025-06-18)
  const serverBaseUrl = new URL(request.url).origin;
  if (!resource || !validateResourceParameter(resource, serverBaseUrl)) {
    return Response.json({ 
      error: 'invalid_target', 
      error_description: 'Invalid or missing resource parameter' 
    }, { status: 400 });
  }
  
  // Retrieve stored authorization code with challenge
  const authCode = getStoredAuthCode(code);
  
  if (!verifyPKCE(authCode.code_challenge, code_verifier)) {
    return Response.json({ error: 'invalid_grant' }, { status: 400 });
  }
  
  // Exchange for tokens with audience binding
  const tokens = await exchangeCodeForTokens(code, {
    audience: resource, // Bind token to specific MCP server
    client_id,
    scopes: authCode.scopes
  });
  
  return Response.json(tokens);
}
```

### Option 2: Enhanced Debugging and Logging (SUPPORTING)

This option supports Option 1 by providing comprehensive logging to verify the fix works correctly:

#### 2.1 Complete OAuth Flow Logging ✅ IMPLEMENTED
```typescript
// Enhanced logging in callback
console.log('=== COMPLETE OAUTH ANALYSIS ===');
console.log('Raw request URL:', request.url);
console.log('Raw state parameter:', stateParam);
console.log('Parsed state:', { originalRedirectUri, originalState });
console.log('Detected client type:', clientType);
console.log('Token details:', {
    id_token_length: tokens.id_token?.length,
    access_token_length: tokens.access_token?.length,
    expires_in: tokens.expires_in
});
console.log('Final redirect strategy:', clientType === 'claude-desktop' ? 'query-params' : 'url-fragments');
console.log('Final redirect URL:', finalRedirectUrl);
console.log('================================');
```

## 🏢 MCP 2025-06-18 OAuth 2.1 Compliance Patterns

**CRITICAL**: All MCP servers must now comply with OAuth 2.1 specification (2025-06-18). Previous OAuth 2.0 implementations are no longer compliant.

### MCP Specification Requirements (2025-06-18)

#### Transport Layer Authentication
- **HTTP Transport**: MUST implement OAuth 2.1 for remote MCP servers
- **STDIO Transport**: SHOULD retrieve credentials from environment (no OAuth)
- **Custom Transports**: MUST follow established security best practices

#### Required OAuth 2.1 Endpoints
1. **Protected Resource Metadata**: `/.well-known/oauth-protected-resource` (RFC 9728)
2. **Authorization Server Metadata**: `/.well-known/oauth-authorization-server` (RFC 8414) 
3. **Authorization Endpoint**: `/oauth/authorize` with PKCE mandatory
4. **Token Endpoint**: `/oauth/token` with resource parameter validation
5. **Registration Endpoint**: `/oauth/register` (RFC 7591) recommended

Based on actual OAuth implementations from production MCP servers:

### GitHub's OAuth Integration
**Deployment**: Remote hosted at `https://api.githubcopilot.com/mcp/`

- **OAuth Bearer Token Transport**:
  ```go
  type bearerAuthTransport struct {
      transport http.RoundTripper
      token     string
  }
  
  func (t *bearerAuthTransport) RoundTrip(req *http.Request) (*http.Response, error) {
      req = req.Clone(req.Context())
      req.Header.Set("Authorization", "Bearer "+t.token)
      return t.transport.RoundTrip(req)
  }
  ```

- **OAuth Configuration for MCP Clients**:
  ```json
  // VS Code (OAuth discovery)
  { "servers": { "github": { "type": "http", "url": "https://api.githubcopilot.com/mcp/" } } }
  ```

- **OAuth Features**: Standard OAuth 2.0 with GitHub provider, bearer token authentication, automatic token refresh

### Neon's Complete OAuth 2.0 Authorization Server
**Deployment**: Remote hosted at `https://mcp.neon.tech/mcp` + Self-hosted Node.js

- **Full OAuth 2.0 Server Implementation**:
  ```typescript
  // Complete OAuth discovery metadata
  export const metadata = (req: ExpressRequest, res: ExpressResponse) => {
    res.json({
      issuer: SERVER_HOST,
      authorization_endpoint: `${SERVER_HOST}/authorize`,
      token_endpoint: `${SERVER_HOST}/token`,
      registration_endpoint: `${SERVER_HOST}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256']
    });
  };
  ```

- **PKCE with S256 Code Challenge**:
  ```typescript
  export const verifyPKCE = (codeChallenge: string, codeChallengeMethod: string, codeVerifier: string): boolean => {
    if (codeChallengeMethod === 'S256') {
      const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      return codeChallenge === hash;
    }
    return false;
  };
  ```

- **OAuth Client Detection for Proper Redirects**:
  ```typescript
  // Neon's client type detection for OAuth redirects
  if (originalRedirectUri.includes('oauth/callback')) {
      clientType = 'claude-desktop';  // Query parameters
  } else if (originalRedirectUri.includes('vscode.dev/redirect')) {
      clientType = 'vscode-web';      // URL fragments  
  } else if (originalRedirectUri.startsWith('http://127.0.0.1:')) {
      clientType = 'vscode-local';    // URL fragments
  }
  ```

- **OAuth Features**: Dynamic client registration, user consent flows, PKCE support, token persistence

### Anthropic Claude (Inferred from Neon's Implementation)
- **Authentication**: OAuth 2.0 with PKCE, expects query parameters
- **Token Format**: Bearer tokens in Authorization header
- **Redirect Method**: Query parameters for desktop clients
- **Client Detection**: `originalRedirectUri.includes('oauth/callback')`
- **Enterprise Features**: Refresh tokens, scope-based permissions

## 📊 OAuth 2.0 Implementation Comparison (Including MCP Remote)

| MCP Client | OAuth Method | OAuth Requirements | Token Delivery | Callback Pattern |
|------------|-------------|-------------------|----------------|------------------|
| **Claude Desktop** | MCP Remote proxy | OAuth discovery + PKCE | MCP Remote handles | `http://127.0.0.1:{port}/oauth/callback` |
| **VS Code Direct** | Built-in OAuth client | Standard OAuth 2.0 | URL fragments | `http://127.0.0.1:{port}/` |
| **MCP Remote** | Full OAuth client | OAuth discovery + PKCE + registration | Stores in `~/.mcp-auth/` | `http://127.0.0.1:{port}/oauth/callback` |
| **Generic Client** | Basic OAuth | Standard OAuth 2.0 | URL fragments | Varies |

### MCP Remote OAuth Flow (Claude Desktop):

```typescript
// MCP Remote's OAuth client expectations
interface MCPRemoteOAuthFlow {
  // 1. OAuth Discovery
  discoveryEndpoint: '/.well-known/oauth-authorization-server';
  
  // 2. Client Registration (optional)
  registrationEndpoint: '/oauth/register';
  
  // 3. Authorization Flow
  authorizationEndpoint: '/oauth/authorize';
  
  // 4. Token Exchange  
  tokenEndpoint: '/oauth/token';
  
  // 5. PKCE Security
  pkceMethod: 'S256';
  
  // 6. Client Type
  clientType: 'public'; // No client secret
  
  // 7. Callback Handling
  callbackPath: '/oauth/callback';
  redirectUri: `http://127.0.0.1:${randomPort}/oauth/callback`;
}
```

### OAuth Token Storage (MCP Remote Pattern):

```typescript
// MCP Remote stores tokens in ~/.mcp-auth/{server_hash}/
interface MCPRemoteTokenStorage {
  directory: '~/.mcp-auth/{server_url_hash}/';
  files: {
    'client_info.json': OAuthClientInformation;
    'tokens.json': OAuthTokens;
    'code_verifier.txt': string; // PKCE verifier
    'lock.json': LockfileData; // Multi-instance coordination
  };
}
```

## 🎯 MCP OAuth 2.1 Implementation Requirements (Specification 2025-06-18)

### Critical Implementation Updates Required

**Our implementation MUST be updated to comply with MCP specification 2025-06-18:**

#### 1. Protected Resource Metadata Endpoint (REQUIRED)
```typescript
// GET /.well-known/oauth-protected-resource
// This endpoint is REQUIRED by RFC 9728 for MCP servers
export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin;
  return Response.json({
    resource: baseUrl,
    authorization_servers: [`${baseUrl}/.well-known/oauth-authorization-server`],
    scopes_supported: ['mcp:read', 'mcp:write', 'mcp:tools'],
    bearer_methods_supported: ['header']
  });
}
```

#### 2. WWW-Authenticate Header on 401 (REQUIRED)
```typescript
// MCP servers MUST include WWW-Authenticate header on 401 responses
if (!isAuthorized) {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Bearer realm="${baseUrl}", resource_server_metadata_url="${baseUrl}/.well-known/oauth-protected-resource"`
    }
  });
}
```

#### 3. Resource Parameter Implementation (REQUIRED)
```typescript
// Authorization requests MUST include resource parameter
const authUrl = new URL(authorizationEndpoint);
authUrl.searchParams.set('resource', mcpServerCanonicalUri);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
```

#### 4. Token Audience Validation (REQUIRED)
```typescript
// MCP servers MUST validate token audience
export function validateTokenAudience(token: string, expectedAudience: string): boolean {
  try {
    const payload = jwt.verify(token, publicKey);
    return payload.aud === expectedAudience || 
           (Array.isArray(payload.aud) && payload.aud.includes(expectedAudience));
  } catch {
    return false;
  }
}
```

## 🎯 OAuth 2.1 Architecture Evolution

### Current Implementation (Google OAuth Pattern)
**Our MCP server follows a standard OAuth 2.0 pattern:**
- ✅ **OAuth 2.0 with Google** (external OAuth provider)
- ✅ **Bearer tokens in Authorization header** (RFC 6750 compliant)
- ✅ **URL fragments for web clients** (OAuth 2.0 best practice)
- ✅ **ID tokens for authentication** (OpenID Connect standard)
- ✅ **Dual token support** (ID tokens + access tokens)

### Recommended OAuth Evolution Path

**Phase 1: Enhanced Client Detection (Immediate)**
```typescript
// Improve client detection for proper OAuth token delivery
const detectOAuthClient = (redirectUri: string) => {
  if (redirectUri.includes('oauth/callback')) return 'claude-desktop';
  if (redirectUri.includes('vscode.dev/redirect')) return 'vscode-web';
  if (redirectUri.startsWith('http://127.0.0.1:')) return 'vscode-local';
  return 'generic';
};
```

**Phase 2: Full OAuth 2.0 Server (Production)**
```typescript
// Complete OAuth 2.0 authorization server
const oauthEndpoints = {
  metadata: '/.well-known/oauth-authorization-server',
  authorize: '/oauth/authorize',
  token: '/oauth/token', 
  register: '/oauth/register',
  userinfo: '/oauth/userinfo'
};
```

**Phase 3: Advanced OAuth Features (Enterprise)**
```typescript
// Enhanced OAuth capabilities
const advancedOAuthFeatures = {
  pkce: 'S256',              // Code challenge for security
  refreshTokens: true,       // Long-term access
  scopeValidation: true,     // Fine-grained permissions
  clientRegistration: true,  // Dynamic client onboarding
  userConsent: true         // Approval dialogs
};
```

This OAuth-focused evolution maintains compatibility while adding enterprise-grade OAuth features.

## ❌ Options NOT Recommended for Production

The following options are **development/debugging only** and should not be considered for production enterprise environments:

### ~~Option 3: VS Code State Parameter Handling~~ (Development Only)
- Complex state decoding logic
- Client-specific workarounds
- Not scalable across different MCP clients

### ~~Option 4: Enhanced Debugging and Logging~~ (Development Only)
- Verbose logging that exposes sensitive information
- Performance overhead in production
- Security risk (token exposure in logs)

### ~~Option 5: Alternative Authentication Methods~~ (Development Only)
- API key authentication (less secure than OAuth)
- Session-based authentication (not stateless)
- Manual token injection (debugging only)

**Production MCP servers should use Option 1 (OAuth 2.0 with proper redirects) as implemented.**

### Option 3: Alternative Authentication Methods

If VS Code continues to have issues with OAuth, consider these alternatives:

#### 3.1 API Key Authentication
Implement a simpler API key-based authentication:

```typescript
// Create a simple API key system
export async function verifyApiKey(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
    if (!bearerToken) return undefined;
    
    // Check against a predefined API key or generate user-specific keys
    const validApiKeys = ['your-api-key-here'];
    
    if (validApiKeys.includes(bearerToken)) {
        return {
            token: bearerToken,
            scopes: ['read:mcp', 'write:mcp'],
            clientId: 'api-key-user',
            extra: { method: 'api-key' }
        };
    }
    
    return undefined;
}
```

#### 3.2 Session-Based Authentication
Store tokens server-side and use session IDs:

```typescript
// Implement session storage (in-memory or database)
const sessions = new Map<string, AuthInfo>();

export async function verifySessionToken(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
    if (!bearerToken) return undefined;
    
    const authInfo = sessions.get(bearerToken);
    if (authInfo && (!authInfo.expiresAt || authInfo.expiresAt > Date.now() / 1000)) {
        return authInfo;
    }
    
    return undefined;
}
```

### Option 4: MCP Configuration Adjustments

#### 4.1 Update .vscode/mcp.json
Try different MCP server configurations:

```json
{
  "servers": {
    "hello-mcp": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "auth": {
        "type": "oauth2",
        "authorization_url": "http://localhost:3000/api/auth/authorize",
        "token_url": "http://localhost:3000/api/auth/token",
        "client_id": "228760319328-g2tmjubea6q0ftpuuuab6p23647eht53.apps.googleusercontent.com",
        "scopes": ["openid", "email", "profile"]
      }
    }
  }
}
```

#### 4.2 Alternative MCP Configuration
```json
{
  "servers": {
    "hello-mcp": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_STATIC_TOKEN_HERE"
      }
    }
  }
}
```

### Option 5: Implement Manual Token Injection

Create a mechanism to manually inject tokens for testing:

#### 5.1 Environment Variable Token
```typescript
// In lib/auth.ts, add a fallback for development
export async function verifyGoogleToken(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
    // ... existing code ...
    
    // Development fallback
    if (!bearerToken && process.env.NODE_ENV === 'development') {
        const devToken = process.env.DEV_AUTH_TOKEN;
        if (devToken) {
            console.log('Using development token');
            return {
                token: devToken,
                scopes: ['read:mcp', 'write:mcp'],
                clientId: 'dev-user',
                extra: { email: 'dev@example.com', name: 'Dev User' }
            };
        }
    }
    
    // ... rest of function ...
}
```

#### 5.2 Token Injection Endpoint
Create an endpoint to manually set tokens for testing:

```typescript
// app/api/debug/set-token/route.ts
export async function POST(req: Request) {
    const { token } = await req.json();
    
    // Store token temporarily (in-memory cache)
    // This is for debugging only
    globalThis.debugToken = token;
    
    return Response.json({ success: true, message: 'Token set for debugging' });
}
```

## 🎯 MCP OAuth 2.1 Implementation Roadmap (Specification 2025-06-18)

### Phase 1: MCP 2025-06-18 Compliance (IMMEDIATE - BREAKING CHANGES)
1. **Implement Protected Resource Metadata endpoint** (`/.well-known/oauth-protected-resource`) - REQUIRED
2. **Add WWW-Authenticate header** on 401 responses with metadata URL - REQUIRED  
3. **Implement resource parameter validation** in authorization/token requests - REQUIRED
4. **Add token audience validation** to verify tokens are issued for this MCP server - REQUIRED
5. **Update OAuth discovery metadata** with MCP-required fields - REQUIRED

### Phase 2: OAuth 2.1 Server Implementation (REQUIRED)
1. **Migrate from OAuth 2.0 to OAuth 2.1** following draft-ietf-oauth-v2-1-13
2. **Implement PKCE as mandatory** (no longer optional)
3. **Add resource indicators support** (RFC 8707) for token audience binding
4. **Implement dynamic client registration** (RFC 7591) for MCP client compatibility
5. **Add HTTPS enforcement** for all authorization endpoints

### Phase 3: Advanced OAuth Features (Enterprise)
1. **Dynamic client registration** for automatic MCP client onboarding
2. **User consent flows** with approval dialogs
3. **Refresh token support** for long-term access
4. **Scope validation** for fine-grained permissions
5. **OAuth userinfo endpoint** for standardized user data

### Phase 4: Production OAuth Security
1. **OAuth security best practices** (token rotation, expiration)
2. **HTTPS enforcement** for all OAuth flows
3. **CSRF protection** for OAuth endpoints
4. **Rate limiting** for OAuth endpoints
5. **Audit logging** for OAuth events

### Current Issue Quick Fix (OAuth Focus)
1. **Use URL fragments for VS Code** (based on Neon's client detection)
2. **Use query parameters for Claude** (follows Neon's pattern)
3. **Implement proper redirect URI validation**
4. **Test OAuth token delivery** to VS Code's local server

## 🔧 Code Implementation Examples

### Enterprise OAuth Callback (Neon-Inspired Implementation)

```typescript
// app/api/auth/callback/google/route.ts - Enterprise version based on Neon's patterns
export async function GET(request: Request) {
    // ... existing OAuth exchange code ...
    
    // Neon-style client type detection
    const originalRedirectUri = client.originalRedirectUri;
    let clientType: string;
    
    if (originalRedirectUri.includes('oauth/callback')) {
        clientType = 'claude-desktop';
    } else if (originalRedirectUri.includes('vscode.dev/redirect')) {
        clientType = 'vscode-web';
    } else if (originalRedirectUri.startsWith('http://127.0.0.1:') || 
               originalRedirectUri.startsWith('http://localhost:')) {
        clientType = 'vscode-local';
    } else {
        clientType = 'generic';
    }
    
    console.log('=== ENTERPRISE OAUTH ANALYSIS ===');
    console.log('Client type detected:', clientType);
    console.log('Original redirect URI:', originalRedirectUri);
    console.log('Token details:', {
        id_token_length: tokens.id_token?.length,
        access_token_length: tokens.access_token?.length,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in
    });
    
    // Enterprise redirect strategy (based on Neon's implementation)
    let finalRedirectUrl: string;
    
    if (clientType === 'claude-desktop') {
        // Claude Desktop uses query parameters
        const clientRedirectUrl = new URL(originalRedirectUri);
        clientRedirectUrl.searchParams.set('access_token', tokens.id_token);
        clientRedirectUrl.searchParams.set('token_type', 'Bearer');
        clientRedirectUrl.searchParams.set('expires_in', tokens.expires_in?.toString() || '3600');
        if (client.originalState) {
            clientRedirectUrl.searchParams.set('state', client.originalState);
        }
        finalRedirectUrl = clientRedirectUrl.toString();
    } else {
        // All other clients (including VS Code local/web) use URL fragments
        const baseUrl = originalRedirectUri.split('#')[0].split('?')[0];
        const tokenParams = new URLSearchParams({
            access_token: tokens.id_token,
            token_type: 'Bearer',
            expires_in: tokens.expires_in?.toString() || '3600',
            state: client.originalState || ''
        });
        
        finalRedirectUrl = `${baseUrl}#${tokenParams.toString()}`;
    }
    
    console.log('Redirect strategy:', clientType === 'claude-desktop' ? 'query-params' : 'url-fragments');
    console.log('Final redirect URL preview:', finalRedirectUrl.substring(0, 100) + '...[MASKED]');
    console.log('=================================');
    
    return Response.redirect(finalRedirectUrl);
}
```

### Enhanced OAuth Token Verification (Google + Neon Patterns)

```typescript
// lib/auth.ts - OAuth-focused verification
export async function verifyOAuthToken(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
    console.log('=== OAUTH TOKEN VERIFICATION ===');
    console.log('Bearer token provided:', !!bearerToken);
    console.log('Token length:', bearerToken?.length || 0);
    console.log('Token prefix:', bearerToken?.substring(0, 10) + '...');
    
    if (!bearerToken) {
        console.log('❌ No OAuth bearer token found');
        return undefined;
    }
    
    // OAuth token type detection
    let oauthMethod: string;
    let verificationResult: AuthInfo | undefined;
    
    try {
        if (bearerToken.startsWith('ya29.')) {
            // Google OAuth access token pattern
            oauthMethod = 'google_oauth_access';
            verificationResult = await verifyGoogleAccessToken(bearerToken);
        } else if (bearerToken.split('.').length === 3) {
            // JWT token pattern (Google ID token)
            oauthMethod = 'google_id_token';
            verificationResult = await verifyGoogleIDToken(bearerToken);
        } else {
            // Try Google UserInfo API as fallback for unknown OAuth token formats
            oauthMethod = 'oauth_fallback';
            verificationResult = await verifyGoogleAccessToken(bearerToken);
        }
        
        if (verificationResult) {
            console.log('✅ OAuth token verified successfully via:', oauthMethod);
            console.log('User context:', {
                clientId: verificationResult.clientId,
                scopes: verificationResult.scopes,
                email: verificationResult.extra?.email,
                oauthMethod
            });
            
            // Add OAuth method to context
            verificationResult.extra = {
                ...verificationResult.extra,
                oauthMethod,
                timestamp: Date.now()
            };
        } else {
            console.log('❌ OAuth token verification failed for method:', oauthMethod);
        }
        
    } catch (error) {
        console.log('❌ OAuth token verification error:', error.message);
        verificationResult = undefined;
    }
    
    console.log('===================================');
    return verificationResult;
}

// Google OAuth access token verification (UserInfo API)
async function verifyGoogleAccessToken(token: string): Promise<AuthInfo | undefined> {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const user = await response.json();
            return {
                token,
                clientId: 'google-oauth',
                scopes: ['openid', 'email', 'profile'],
                extra: {
                    email: user.email,
                    name: user.name,
                    picture: user.picture,
                    provider: 'google',
                    tokenType: 'oauth_access'
                }
            };
        }
    } catch (error) {
        console.log('Google OAuth access token verification failed:', error.message);
    }
    return undefined;
}

// Google ID token verification (JWT)
async function verifyGoogleIDToken(token: string): Promise<AuthInfo | undefined> {
    try {
        const { OAuth2Client } = await import('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        if (payload) {
            return {
                token,
                clientId: 'google-oauth',
                scopes: ['openid', 'email', 'profile'],
                extra: {
                    email: payload.email,
                    name: payload.name,
                    picture: payload.picture,
                    provider: 'google',
                    tokenType: 'oauth_id_token'
                }
            };
        }
    } catch (error) {
        console.log('Google ID token verification failed:', error.message);
    }
    return undefined;
}
```

## 📋 MCP Remote + OAuth 2.0 Testing Checklist

### MCP Remote Compatibility
- [ ] OAuth discovery metadata endpoint (`/.well-known/oauth-authorization-server`) responds correctly
- [ ] Claude Desktop can find and parse OAuth server metadata
- [ ] MCP Remote can perform dynamic client registration (or static client works)
- [ ] PKCE S256 code challenge generation and verification works
- [ ] OAuth callback endpoint accepts authorization codes from MCP Remote
- [ ] Token exchange endpoint returns proper OAuth tokens to MCP Remote

### OAuth Flow Integration
- [ ] Claude Desktop launches browser for OAuth authorization
- [ ] User can complete OAuth consent flow in browser
- [ ] Authorization code is properly exchanged for access tokens
- [ ] MCP Remote stores tokens in `~/.mcp-auth/{server_hash}/` directory
- [ ] Subsequent MCP requests include proper Authorization headers
- [ ] Token refresh works when access tokens expire

### MCP Protocol Integration
- [ ] Claude Desktop connects to MCP Remote via stdio transport
- [ ] MCP Remote connects to your OAuth-enabled MCP server via HTTP/SSE
- [ ] OAuth tokens are included in all MCP server requests
- [ ] Your MCP server properly verifies OAuth tokens
- [ ] MCP tools receive authenticated user context
- [ ] Error handling provides clear feedback through the proxy chain

### Claude Desktop Configuration
- [ ] `claude_desktop_config.json` contains correct MCP Remote configuration
- [ ] MCP Remote can connect to your OAuth-enabled server URL
- [ ] Environment variables (if used) are properly set
- [ ] MCP Remote logs show successful OAuth flow completion
- [ ] Claude Desktop shows MCP tools/resources in the interface

### OAuth Security Validation
- [ ] OAuth state parameter prevents CSRF attacks
- [ ] PKCE code verifier protects against authorization code interception
- [ ] OAuth redirect URI validation prevents open redirects
- [ ] OAuth tokens have appropriate expiration times
- [ ] Refresh tokens work for long-term access (if implemented)
- [ ] OAuth tokens are not logged in production

### Debugging Tools
- [ ] MCP Remote debug logs (`--debug` flag) show OAuth flow details
- [ ] Your OAuth server logs show MCP Remote requests
- [ ] Claude Desktop logs show MCP Remote connection status
- [ ] Token storage directory (`~/.mcp-auth/`) contains expected files
- [ ] OAuth endpoints return proper error codes for debugging

## 🎯 MCP Remote + OAuth 2.0 Expected Outcomes

After implementing MCP Remote-compatible OAuth 2.0, you should see:

### Immediate Claude Desktop Compatibility
1. **Claude Desktop integration** - Works seamlessly through MCP Remote proxy
2. **OAuth discovery** - MCP Remote finds and uses your OAuth endpoints
3. **PKCE security** - Proper code challenge verification for enhanced security
4. **Token management** - MCP Remote handles OAuth token storage and refresh

### Production OAuth Features
1. **Complete OAuth 2.0 compliance** - Full authorization server compatible with MCP Remote
2. **Multi-client support** - Works with Claude Desktop, VS Code, and other MCP clients
3. **OAuth security best practices** - PKCE, state validation, secure token handling
4. **Enterprise scalability** - Database-backed storage, audit logging, rate limiting

### MCP Remote Integration Success Indicators

**Phase 1 (MCP Remote Compatibility)**:
```
✅ OAuth discovery metadata served at /.well-known/oauth-authorization-server
✅ MCP Remote client registration successful (or static client configured)
✅ PKCE S256 code challenge verification working
✅ OAuth authorization flow redirects to browser correctly
✅ Authorization code exchange returns valid tokens
✅ MCP Remote stores tokens in ~/.mcp-auth/{server_hash}/
```

**Phase 2 (Claude Desktop Integration)**:
```
✅ Claude Desktop config: npx mcp-remote https://your-server.com/api/mcp
✅ MCP Remote connects to your OAuth server successfully
✅ OAuth flow completes in browser with user consent
✅ Claude Desktop shows MCP tools/resources in interface
✅ MCP requests include proper Authorization headers
✅ Your MCP server receives authenticated user context
```

**Phase 3 (Advanced OAuth Features)**:
```
✅ Dynamic client registration for automatic onboarding
✅ Refresh token support for long-term access
✅ User consent flows with approval dialogs
✅ Scope validation for fine-grained permissions
✅ Multi-transport support (HTTP + SSE)
```

### Claude Desktop Configuration Example

**Working `claude_desktop_config.json`**:
```json
{
  "mcpServers": {
    "your-oauth-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-server.com/api/mcp"
      ]
    }
  }
}
```

**Debug Configuration with Logging**:
```json
{
  "mcpServers": {
    "your-oauth-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-server.com/api/mcp",
        "--debug"
      ]
    }
  }
}
```

The MCP Remote-compatible implementation ensures Claude Desktop can seamlessly access your OAuth-protected MCP server while maintaining enterprise-grade security and following OAuth 2.0 best practices.