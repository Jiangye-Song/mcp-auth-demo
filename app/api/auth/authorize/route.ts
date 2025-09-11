import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

/**
 * OAuth 2.1 Authorization Endpoint with MCP 2025-06-18 Compliance
 * Supports PKCE, resource parameters, and enhanced client detection
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Extract OAuth 2.1 parameters
    const responseType = searchParams.get('response_type');
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const scope = searchParams.get('scope');
    const state = searchParams.get('state');
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method');

    // MCP 2025-06-18: Resource parameter (RFC 8707)
    const resource = searchParams.get('resource');

    console.log('🔐 OAuth 2.1 Authorization Request (MCP 2025-06-18)');
    console.log('Response Type:', responseType);
    console.log('Client ID:', clientId);
    console.log('Redirect URI:', redirectUri);
    console.log('Scope:', scope);
    console.log('State:', state);
    console.log('Code Challenge Method:', codeChallengeMethod);
    console.log('Resource Parameter:', resource);

    // OAuth 2.1 Validation
    if (responseType !== 'code') {
        console.log('❌ Invalid response_type - OAuth 2.1 only allows "code"');
        return redirectWithError(redirectUri, 'unsupported_response_type', 'OAuth 2.1 only supports authorization code flow', state);
    }

    if (!clientId) {
        console.log('❌ Missing client_id');
        return redirectWithError(redirectUri, 'invalid_request', 'client_id is required', state);
    }

    if (!redirectUri) {
        return NextResponse.json({
            error: 'invalid_request',
            error_description: 'redirect_uri is required'
        }, { status: 400 });
    }

    // OAuth 2.1: PKCE is recommended but not mandatory for all clients (VS Code compatibility)
    if (codeChallenge && codeChallengeMethod !== 'S256') {
        console.log('⚠️ Invalid PKCE method - only S256 is supported');
        return redirectWithError(redirectUri, 'invalid_request', 'Only S256 code challenge method is supported', state);
    }

    if (codeChallenge) {
        console.log('✅ PKCE S256 detected - enhanced security enabled');
    } else {
        console.log('⚠️ No PKCE - proceeding for VS Code compatibility');
    }

    // MCP 2025-06-18: Validate resource parameter if provided
    if (resource) {
        const baseUrl = new URL(request.url).origin;
        try {
            const resourceUrl = new URL(resource);
            if (resourceUrl.origin !== baseUrl) {
                console.log('❌ Invalid resource parameter - must match server origin');
                return redirectWithError(redirectUri, 'invalid_target', 'Resource parameter must match server origin', state);
            }
        } catch {
            console.log('❌ Invalid resource parameter format');
            return redirectWithError(redirectUri, 'invalid_target', 'Invalid resource parameter format', state);
        }
    }

    // Validate redirect URI (OAuth 2.1 requires exact match)
    const validRedirectUris = [
        'http://127.0.0.1:3334/oauth/callback', // MCP Remote
        'http://localhost:3334/oauth/callback',  // MCP Remote
        'http://127.0.0.1:33418/',              // VS Code local server (default port)
        'http://localhost:33418/',              // VS Code local server (default port)
        'https://vscode.dev/redirect',          // VS Code web redirect
        'https://insiders.vscode.dev/redirect', // VS Code Insiders web redirect
        'vscode://ms-vscode.vscode-mcp/oauth-callback', // VS Code protocol URL
        'vscode-insiders://ms-vscode.vscode-mcp/oauth-callback', // VS Code Insiders protocol URL
        `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
        `${new URL(request.url).origin}/api/auth/callback/google`
    ];

    // Allow dynamic ports for VS Code and MCP Remote
    const vsCodePattern = /^http:\/\/127\.0\.0\.1:\d+\/?$/;
    const vsCodeLocalhostPattern = /^http:\/\/localhost:\d+\/?$/;
    const mcpRemotePattern = /^http:\/\/(127\.0\.0\.1|localhost):\d+\/oauth\/callback$/;
    const mcpRemoteLocalhostPattern = /^http:\/\/localhost:\d+\/oauth\/callback$/;

    const isValidDynamicRedirect =
        vsCodePattern.test(redirectUri) ||
        vsCodeLocalhostPattern.test(redirectUri) ||
        mcpRemotePattern.test(redirectUri) ||
        mcpRemoteLocalhostPattern.test(redirectUri) ||
        redirectUri.startsWith('vscode://') ||
        redirectUri.startsWith('vscode-insiders://');

    if (!validRedirectUris.includes(redirectUri) && !isValidDynamicRedirect) {
        console.log('❌ Invalid redirect_uri:', redirectUri);
        console.log('📋 Allowed patterns: VS Code (127.0.0.1:port/), MCP Remote (localhost:port/oauth/callback)');
        return NextResponse.json({
            error: 'invalid_request',
            error_description: 'Invalid redirect_uri'
        }, { status: 400 });
    }

    // Log successful redirect URI validation
    if (mcpRemotePattern.test(redirectUri) || mcpRemoteLocalhostPattern.test(redirectUri)) {
        console.log('✅ MCP Remote redirect URI validated:', redirectUri);
    } else if (vsCodePattern.test(redirectUri) || vsCodeLocalhostPattern.test(redirectUri)) {
        console.log('✅ VS Code redirect URI validated:', redirectUri);
    } else {
        console.log('✅ Static redirect URI validated:', redirectUri);
    }

    // Generate authorization code
    const authCode = randomBytes(32).toString('base64url');

    // Store authorization code with PKCE challenge and resource (in production, use database)
    if (!(globalThis as any).authCodes) {
        (globalThis as any).authCodes = new Map();
    }

    (globalThis as any).authCodes.set(authCode, {
        clientId,
        redirectUri,
        scope: scope || 'openid profile email mcp:read mcp:write',
        codeChallenge,
        codeChallengeMethod,
        resource, // Store resource parameter for token exchange
        createdAt: Date.now(),
        expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
    });

    // Build Google OAuth URL with resource parameter
    const googleOAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleOAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
    googleOAuthUrl.searchParams.set('redirect_uri', `${new URL(request.url).origin}/api/auth/callback/google`);
    googleOAuthUrl.searchParams.set('response_type', 'code');
    googleOAuthUrl.searchParams.set('scope', 'openid profile email');
    googleOAuthUrl.searchParams.set('access_type', 'offline');
    googleOAuthUrl.searchParams.set('prompt', 'consent');

    // Encode our state to preserve OAuth flow context
    const encodedState = Buffer.from(JSON.stringify({
        originalState: state,
        originalRedirectUri: redirectUri,
        authCode: authCode,
        resource: resource, // Preserve resource parameter
        clientId: clientId
    })).toString('base64url');

    googleOAuthUrl.searchParams.set('state', encodedState);

    console.log('🚀 Redirecting to Google OAuth with state preservation');
    console.log('Auth Code Generated:', authCode);
    console.log('OAuth 2.1 + MCP 2025-06-18 Compliance: ENABLED');

    return NextResponse.redirect(googleOAuthUrl.toString());
}

function redirectWithError(redirectUri: string | null, error: string, errorDescription: string, state: string | null) {
    if (!redirectUri) {
        return NextResponse.json({
            error,
            error_description: errorDescription
        }, { status: 400 });
    }

    const errorUrl = new URL(redirectUri);
    errorUrl.searchParams.set('error', error);
    errorUrl.searchParams.set('error_description', errorDescription);
    if (state) {
        errorUrl.searchParams.set('state', state);
    }

    return NextResponse.redirect(errorUrl.toString());
}