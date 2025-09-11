# Testing Guide for MCP Authentication Fix

## 🎯 Step-by-Step Testing Process

### Phase 1: Apply the URL Fragments Fix

1. **Restart the development server**:
   ```bash
   # Stop current server (Ctrl+C)
   pnpm dev
   ```

2. **Restart VS Code** to clear any cached authentication state

3. **Test the MCP connection** and watch for the new log format:

   **Expected Success Log**:
   ```
   🔥 OAUTH CALLBACK HIT 🔥
   Using URL fragments for VS Code/generic client
   Final generic redirect URL (token masked): https://vscode.dev/redirect#access_token=[ID_TOKEN_MASKED]&token_type=Bearer&expires_in=3600&state=...
   
   === ENHANCED TOKEN VERIFICATION ===
   Bearer token provided: true
   Token length: 1157
   ✅ authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjljNjI1...
   Final token status: true
   ```

   **If Still Failing**:
   ```
   Using URL fragments for VS Code/generic client
   Final generic redirect URL (token masked): https://vscode.dev/redirect#access_token=[ID_TOKEN_MASKED]...
   
   === ENHANCED TOKEN VERIFICATION ===
   Bearer token provided: false
   ❌ authorization: not present
   Final token status: false
   ```

### Phase 2: If Still Failing - Enable Development Bypass

1. **Add to `.env.local`**:
   ```env
   SKIP_AUTH=true
   NODE_ENV=development
   ```

2. **Restart server and test**:
   
   **Expected Success Log**:
   ```
   🚨 DEVELOPMENT MODE: Skipping authentication completely
   👋 Hello, World! (authenticated as Development User <dev@example.com>)
   ```

   This confirms the MCP handler itself works - the issue is purely authentication.

### Phase 3: Manual Token Testing

If the URL fragments fix doesn't work, extract a real token and test manually:

1. **Get a real Google ID token from the OAuth flow**:
   - Look for this in the server logs: `ID token preview: eyJhbGciOiJSUzI1NiIsImtpZCI6IjljNjI1...`
   - Copy the full token (not just the preview)

2. **Inject the token for testing**:
   ```bash
   curl -X POST http://localhost:3000/api/debug/inject-token \
     -H "Content-Type: application/json" \
     -d '{"token":"eyJhbGciOiJSUzI1NiIsImtpZCI6IjljNjI1..."}'
   ```

3. **Test MCP with the injected token**:
   
   **Expected Success Log**:
   ```
   🧪 Using injected debug token
   Google token verification succeeded
   👋 Hello, World! (authenticated as songjiangye2021@gmail.com)
   ```

### Phase 4: Static Token Configuration

If manual injection works, test with static configuration:

1. **Update `.vscode/mcp.json`**:
   ```json
   {
     "servers": {
       "hello-mcp": {
         "type": "http",
         "url": "http://localhost:3000/api/mcp",
         "headers": {
           "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjljNjI1..."
         }
       }
     }
   }
   ```

2. **Remove development bypass** from `.env.local`:
   ```env
   # SKIP_AUTH=true  # Comment this out
   ```

3. **Restart VS Code and test**

## 🔍 Debugging Commands

### Check Current Debug Token Status
```bash
curl http://localhost:3000/api/debug/inject-token
```

### Clear Debug Token
```bash
curl -X DELETE http://localhost:3000/api/debug/inject-token
```

### Test MCP Endpoint Directly
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Test with Development Bypass
```bash
# With SKIP_AUTH=true in .env.local
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"say_hello","arguments":{"name":"Test"}}}'
```

## 📊 Expected Outcomes

### ✅ Success Scenario
```
=== ENHANCED TOKEN VERIFICATION ===
Bearer token provided: true
Token length: 1157
✅ authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjljNjI1...
Final token status: true
===================================
Verifying Google ID token...
Token appears to be a JWT ID token
ID token verified successfully for user: songjiangye2021@gmail.com
```

### ❌ Still Failing After URL Fragments Fix
This indicates VS Code has a different expectation. Try these additional approaches:

#### Option A: Different Token Format
- Try returning the Google access token instead of ID token
- Try a custom token format

#### Option B: Different OAuth Flow
- Implement device flow instead of authorization code flow
- Use PKCE parameters differently

#### Option C: VS Code MCP Configuration
- Try different MCP server configuration options
- Check if VS Code expects different authentication metadata

## 🎯 Success Criteria

The fix is successful when you see:

1. **OAuth completes successfully** ✅ (already working)
2. **VS Code includes Authorization header** in MCP requests ✅ (this is what we're fixing)
3. **Token verification succeeds** ✅ (already working for manual tests)
4. **MCP tools respond with authenticated user context** ✅ (already working)

## 🚀 Next Steps After Success

Once you identify the working solution:

1. **Remove all development bypasses**
2. **Clean up debug endpoints** (or leave them for future debugging)
3. **Document the exact configuration** that worked
4. **Test with a fresh VS Code installation** to confirm it's not relying on cached state

## 🆘 If All Else Fails

If none of these approaches work, the issue might be:

1. **VS Code version compatibility** - Try VS Code Stable vs Insiders
2. **MCP SDK version** - Check if there's a newer version
3. **Network/proxy issues** - Check if corporate firewall interferes
4. **Local environment** - Try on a different machine

In that case, document exactly what works (static tokens, development bypass) and consider alternative MCP clients for testing.