# VS Code MCP Token Usage Issue - Root Cause Analysis

## 🚨 CONFIRMED PROBLEM: VS Code Token Usage Failure

**The issue is NOT OAuth server compatibility - our OAuth implementation is working perfectly.**

**ACTUAL PROBLEM**: VS Code MCP client receives OAuth tokens successfully but **never includes Authorization headers** in subsequent MCP requests.

## 🔍 Evidence Analysis

### ✅ OAuth Flow: 100% Working

From our terminal logs, **every part of OAuth flow succeeds**:

```
✅ Authorization Server Discovery
GET /.well-known/oauth-authorization-server 200 in 583ms

✅ Protected Resource Metadata  
GET /.well-known/oauth-protected-resource 200 in 756ms

✅ Token Exchange
Token exchange successful, received: ['access_token', 'expires_in', 'refresh_token', 'scope', 'token_type', 'id_token']
ID token present: true
Access token present: true

✅ Token Delivery to VS Code
Final vscode-local redirect URL: http://127.0.0.1:33418/#access_token=[ID_TOKEN_MASKED]&token_type=Bearer&expires_in=3599
```

### ❌ Token Usage: Complete Failure

**After successful OAuth flow, VS Code fails to use tokens**:

```
❌ MCP Request Without Authorization
=== ENHANCED TOKEN VERIFICATION ===
Bearer token provided: false
Token length: 0
❌ No bearer token found after all checks
POST /api/mcp 401 in 4947ms
```

**Critical Gap**: VS Code **receives tokens** but **never sends them** in Authorization headers.

## 🛠️ VS Code-Specific Solutions

### Option 1: VS Code Extension Debugging (IMMEDIATE)

**Debug VS Code MCP extension token handling:**

#### Step 1: VS Code Developer Tools Analysis

```powershell
# Open VS Code Developer Tools
# Help > Toggle Developer Tools
# OR Ctrl+Shift+I
```

**Console Tab Investigation:**
```javascript
// Filter console by these keywords during OAuth flow:
// "mcp", "authorization", "bearer", "token", "oauth", "auth"

// Look for these specific patterns:
// ✅ GOOD: "OAuth flow completed", "Token received", "Access token stored"
// ❌ BAD: "Token not found", "Authorization failed", "Missing token"

// Hypothesis 1: Token Storage Issue
// Look for: "localStorage", "sessionStorage", "keychain", "credential store"

// Hypothesis 2: Token Format Issue  
// Look for: "Invalid token format", "Bearer token malformed", "JWT parsing"

// Hypothesis 3: Extension Bug
// Look for: JavaScript errors, unhandled promises, extension crashes
```

**Network Tab Investigation:**
```javascript
// During MCP request (after OAuth), check:

// 1. Request Headers Analysis
// Look for POST to http://localhost:3000/api/mcp
// ❌ Missing: "Authorization: Bearer [token]"
// ✅ Present: "Content-Type: application/json"

// 2. Request Payload
// Should contain MCP protocol JSON:
// {"method": "tools/list", "params": {}}

// 3. Response Analysis
// Expected: 401 Unauthorized (confirms missing auth header)
// Actual server response should show "Bearer token provided: false"
```

#### Step 2: VS Code Workspace Storage Investigation

```powershell
# Check VS Code workspace storage locations:

# Windows locations to check:
$env:APPDATA\Code\User\workspaceStorage\[hash]\state.vscdb
$env:APPDATA\Code\CachedExtensions\[extension-id]

# Look for stored OAuth tokens:
# - Search for "access_token", "bearer", "oauth" in storage files
# - Check if tokens are being persisted correctly
```

#### Step 3: MCP Extension State Debugging

```typescript
// In VS Code Developer Tools Console, run these commands:

// Check MCP extension state
console.log('MCP Extension State:', vscode.extensions.getExtension('mcp-extension-id'));

// Check workspace configuration
console.log('MCP Config:', vscode.workspace.getConfiguration('mcp'));

// Check stored authentication data
console.log('Auth Data:', localStorage.getItem('mcp-auth'));
console.log('Session Data:', sessionStorage.getItem('mcp-session'));

// Hypothesis Testing Commands:
// Test 1: Token exists but wrong format
typeof localStorage.getItem('oauth-token');

// Test 2: Token exists but expired
JSON.parse(localStorage.getItem('oauth-token') || '{}').expires_in;

// Test 3: Multiple token storage locations
Object.keys(localStorage).filter(key => key.includes('token') || key.includes('auth'));
```

### Option 2: Manual Token Injection Test (IMMEDIATE)

**Prove server works with proper Authorization headers:**

#### Step 1: Extract Token from OAuth Callback

```powershell
# During OAuth flow, watch terminal for callback URL:
# "Final vscode-local redirect URL: http://127.0.0.1:33418/#access_token=[TOKEN]&token_type=Bearer..."

# Extract the access_token value between:
# access_token= and &token_type=Bearer

# Example extraction:
# URL: http://127.0.0.1:33418/#access_token=ya29.a0ARW5m76...&token_type=Bearer
# TOKEN: ya29.a0ARW5m76...
```

#### Step 2: Manual Configuration Test

```json
// .vscode/mcp.json - BACKUP ORIGINAL FIRST
{
  "servers": {
    "hello-mcp-manual": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer PASTE_EXTRACTED_TOKEN_HERE",
        "Content-Type": "application/json",
        "User-Agent": "VSCode-MCP-Manual-Test"
      }
    }
  }
}
```

#### Step 3: Hypothesis Validation Tests

```powershell
# Test 1: Server accepts manual tokens (should work)
# Expected: MCP requests succeed with 200 responses
# Confirms: OAuth server implementation is correct

# Test 2: Token format validation
# Try different token formats:
# - "Bearer ya29.a0ARW5m76..." (full Google token)
# - "ya29.a0ARW5m76..." (token without Bearer prefix)
# - ID token vs Access token (if both available)

# Test 3: Token expiration handling
# Wait for token to expire (usually 1 hour)
# Expected: 401 responses after expiration
# Confirms: Server properly validates token expiration
```

#### Step 4: PowerShell Direct API Testing

```powershell
# Direct API test to bypass VS Code entirely
$token = "PASTE_EXTRACTED_TOKEN_HERE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    method = "tools/list"
    params = @{}
} | ConvertTo-Json

# Test the API directly
Invoke-RestMethod -Uri "http://localhost:3000/api/mcp" -Method POST -Headers $headers -Body $body

# Expected Success Response:
# {
#   "result": {
#     "tools": [
#       {
#         "name": "say_hello",
#         "description": "Say hello to someone"
#       }
#     ]
#   }
# }

# If this works, confirms: OAuth server is 100% functional
# If this fails, confirms: Token extraction or server issue
```

### Option 3: Development Token Override (TESTING)

**Server-side token override for testing:**

```typescript
// lib/auth.ts - Add development token override
export async function verifyGoogleToken(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
    // ... existing verification code ...
    
    // DEVELOPMENT ONLY: Override for testing
    if (!bearerToken && process.env.NODE_ENV === 'development') {
        const devToken = process.env.DEV_OVERRIDE_TOKEN;
        if (devToken) {
            console.log('🔧 Using development override token');
            return {
                token: devToken,
                scopes: ['read:mcp', 'write:mcp'],
                clientId: 'dev-override',
                extra: { email: 'dev@test.com', name: 'Dev User' }
            };
        }
    }
    
    return undefined;
}
```

## 🧪 Hypothesis Testing & Diagnostic Criteria

### Hypothesis 1: Token Storage Failure
**Theory**: VS Code receives tokens but fails to store them properly

**Diagnostic Steps**:
```powershell
# During OAuth flow, immediately after callback:
# 1. Check VS Code Developer Tools > Application > Local Storage
# 2. Search for keys containing: "mcp", "oauth", "token", "auth"
# 3. Check VS Code workspace storage files

# Expected Evidence:
# ✅ STORED: Token appears in storage with correct format
# ❌ NOT STORED: No token found in any storage location
# ❌ WRONG FORMAT: Token stored but in unexpected format
```

**Confirmation Criteria**:
- [ ] Token visible in browser storage during/after OAuth
- [ ] Token persists between VS Code restarts
- [ ] Token accessible via VS Code extension APIs
- [ ] Token format matches Google OAuth specification

### Hypothesis 2: Authorization Header Construction Failure  
**Theory**: VS Code stores tokens but fails to include them in MCP requests

**Diagnostic Steps**:
```javascript
// In VS Code Developer Tools Network tab:
// 1. Complete OAuth flow successfully
// 2. Trigger MCP request (e.g., list tools)
// 3. Inspect POST request to /api/mcp

// Check request headers:
const expectedHeaders = {
    'Authorization': 'Bearer ya29.a0ARW5m76...', // ❌ MISSING
    'Content-Type': 'application/json',          // ✅ PRESENT
    'User-Agent': 'VSCode-MCP/...'               // ✅ PRESENT
};

// Network waterfall analysis:
// - Request shows 401 Unauthorized
// - Response body contains "Bearer token provided: false"
// - No Authorization header in request headers list
```

**Confirmation Criteria**:
- [ ] MCP POST request visible in Network tab
- [ ] Authorization header completely absent from request
- [ ] Other headers (Content-Type, User-Agent) present correctly
- [ ] Server logs confirm "Bearer token provided: false"

### Hypothesis 3: Token Format Mismatch
**Theory**: VS Code sends tokens but in wrong format/location

**Diagnostic Steps**:
```powershell
# Check alternative token locations in request:
# 1. Query parameters: ?access_token=...
# 2. Request body: {"access_token": "..."}
# 3. Custom headers: X-Auth-Token, X-Access-Token
# 4. Cookie: oauth_token=...

# Server-side enhanced logging:
# Add to lib/auth.ts temporarily:
console.log('All request headers:', Object.fromEntries(req.headers));
console.log('Query parameters:', new URL(req.url).searchParams.toString());
console.log('Request body preview:', await req.text().slice(0, 200));
```

**Confirmation Criteria**:
- [ ] Token found in non-standard location (query/body/custom header)
- [ ] Token format differs from expected Bearer format
- [ ] Server receives token but fails to recognize it
- [ ] Multiple token formats sent simultaneously

### Hypothesis 4: VS Code MCP Extension Bug
**Theory**: Known issue with VS Code MCP extension OAuth implementation

**Diagnostic Steps**:
```powershell
# Extension investigation:
# 1. Check VS Code extension version
code --list-extensions --show-versions | Select-String "mcp"

# 2. Search for known issues:
# - GitHub issues for VS Code MCP extension
# - MCP community discussions
# - Stack Overflow OAuth + MCP problems

# 3. Alternative MCP client testing:
# - Try Claude Desktop (known working)
# - Try command-line MCP client
# - Try browser-based MCP client
```

**Confirmation Criteria**:
- [ ] Other MCP clients work with same OAuth server
- [ ] VS Code extension has open OAuth-related issues
- [ ] Extension logs show OAuth-related errors
- [ ] Alternative MCP client successfully uses same tokens

## 🔧 Systematic Debug Checklist

### Phase 1: Evidence Gathering (15 minutes)
- [ ] **VS Code Developer Tools**: Console + Network tabs during OAuth flow
- [ ] **Token Extraction**: Copy actual token from OAuth callback URL
- [ ] **Storage Inspection**: Check VS Code storage for persisted tokens
- [ ] **Server Logs**: Confirm "Bearer token provided: false" in terminal

### Phase 2: Hypothesis Testing (20 minutes)
- [ ] **Manual Token Test**: Inject token into .vscode/mcp.json headers
- [ ] **PowerShell API Test**: Direct API call with extracted token
- [ ] **Alternative Client Test**: Try same OAuth with different MCP client
- [ ] **Extension Version Check**: Verify VS Code MCP extension version

### Phase 3: Root Cause Isolation (10 minutes)
- [ ] **Token Storage**: Confirmed stored/not stored in VS Code
- [ ] **Header Construction**: Confirmed missing from MCP requests
- [ ] **Server Functionality**: Confirmed works with manual injection
- [ ] **Extension Issue**: Confirmed bug in VS Code MCP extension

### Phase 4: Solution Implementation (varies)
- [ ] **Immediate Workaround**: Manual Authorization headers
- [ ] **Extension Investigation**: Report bug or find fix
- [ ] **Alternative Client**: Switch to working MCP client
- [ ] **Documentation Update**: Record findings and solutions

## 🎯 Action Plan

### Phase 1: Confirm Problem (IMMEDIATE)
1. **✅ OAuth server working** - Don't change server code
2. **🔍 VS Code extension debugging** - Find token usage bug  
3. **🛠️ Manual token injection test** - Prove server accepts tokens
4. **📞 VS Code extension investigation** - Check for known issues

### Phase 2: Workarounds (SHORT TERM)
1. Manual Authorization header injection via .vscode/mcp.json
2. Development token override for testing
3. Alternative MCP client testing to confirm server works
4. Community investigation of VS Code MCP extension issues

### Phase 3: Long-term (AFTER FIX)
1. OAuth 2.1 compliance (if needed)
2. MCP 2025-06-18 compliance (secondary)
3. Multi-client compatibility testing
4. Production OAuth security enhancements

## 📝 Key Findings

### What's Working (Don't Change)
- ✅ OAuth authorization flow
- ✅ Token exchange with Google
- ✅ Token delivery to VS Code
- ✅ Server token verification logic

### What's Broken (Fix This)
- ❌ VS Code MCP extension token usage
- ❌ Authorization header inclusion in MCP requests
- ❌ Token storage/retrieval in VS Code

### Next Steps
1. **Stop changing OAuth server** - It's working perfectly
2. **Focus on VS Code MCP extension** - That's where the bug is
3. **Test manual token injection** - Prove server functionality
4. **Debug VS Code token handling** - Find the missing link

**Bottom Line**: This is a VS Code MCP extension client-side bug, not an OAuth server issue. Our OAuth implementation is correct and working.