import { NextRequest, NextResponse } from 'next/server';

/**
 * Custom OAuth authorization endpoint that ensures proper scope parameter
 * This endpoint redirects to Google OAuth with the required parameters
 * Supports both VS Code and Claude Desktop dynamic callback ports
 */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Get parameters from the incoming request
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const originalRedirectUri = searchParams.get('redirect_uri');
    const state = searchParams.get('state') || '';
    const responseType = searchParams.get('response_type') || 'code';

    console.log('Authorization request received:', {
        originalRedirectUri,
        state,
        responseType,
        codeChallenge: searchParams.get('code_challenge') ? 'present' : 'missing',
        userAgent: request.headers.get('user-agent'),
        stateContainsJson: state.includes('{'),
        stateContainsManualTest: state.includes('manual-test'),
        stateContainsSimpleTest: state.includes('simple-test')
    });

    // For mcp-remote, we should NOT modify the state parameter as it uses it for PKCE coordination
    // But we need to store the original redirect URI somehow so we can forward back to localhost
    let finalState: string;

    // Check if this looks like a manual test (contains JSON) vs mcp-remote (simple string)
    const isManualTest = state.includes('{') || state.includes('manual-test') || state.includes('simple-test');

    if (isManualTest) {
        // For manual testing, parse and extend the state
        try {
            const existingStateData = state ? JSON.parse(state) : {};
            finalState = JSON.stringify({
                originalState: existingStateData.originalState || state,
                originalRedirectUri: originalRedirectUri,
                codeVerifier: existingStateData.codeVerifier || null
            });
        } catch (e) {
            // State is not JSON, treat as simple string
            finalState = JSON.stringify({
                originalState: state,
                originalRedirectUri: originalRedirectUri,
                codeVerifier: null
            });
        }
        console.log('Manual test detected, extended state for callback coordination');
    } else {
        // For mcp-remote, we need to preserve their state but also store the redirect URI
        // We'll encode both pieces of information in a way that preserves mcp-remote's state
        finalState = JSON.stringify({
            mcpState: state,  // Preserve mcp-remote's original state
            originalRedirectUri: originalRedirectUri  // Store for our callback forwarding
        });
        console.log('MCP-Remote detected, storing redirect URI while preserving state for PKCE coordination');
        console.log('Wrapped state:', finalState);
    }    // Determine which redirect URI to use based on the original request
    let finalRedirectUri: string;

    // Get the production URL from Vercel environment or construct from request
    const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : url.origin;

    if (isManualTest) {
        // For manual testing, use our server's callback endpoint
        if (originalRedirectUri?.includes('/oauth/callback')) {
            finalRedirectUri = `${productionUrl}/oauth/callback`;
        } else {
            finalRedirectUri = `${productionUrl}/api/auth/callback/google`;
        }
        console.log('Manual test - using server callback:', finalRedirectUri);
    } else {
        // For mcp-remote, ALWAYS use our production server callback
        // We'll handle forwarding the code back to mcp-remote's localhost in the callback handler
        finalRedirectUri = `${productionUrl}/oauth/callback`;
        console.log('MCP-Remote - using production server callback (will forward to localhost):', finalRedirectUri);
    }

    // Ensure we always include the required scope parameter
    const scope = 'openid email profile';

    // Build the Google OAuth authorization URL with all required parameters
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId!);
    googleAuthUrl.searchParams.set('redirect_uri', finalRedirectUri);
    googleAuthUrl.searchParams.set('response_type', responseType);
    googleAuthUrl.searchParams.set('scope', scope);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');
    googleAuthUrl.searchParams.set('state', finalState);

    // Add PKCE parameters if provided (for Claude Desktop)
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method');
    if (codeChallenge && codeChallengeMethod) {
        googleAuthUrl.searchParams.set('code_challenge', codeChallenge);
        googleAuthUrl.searchParams.set('code_challenge_method', codeChallengeMethod);
        console.log('Added PKCE parameters for Claude Desktop');
    }

    // Note: We deliberately exclude the 'resource' parameter as it's not supported by Google OAuth
    const resourceParam = searchParams.get('resource');
    if (resourceParam) {
        console.log('Ignoring unsupported resource parameter:', resourceParam);
    }

    console.log('Client redirect URI:', originalRedirectUri);
    console.log('Using final redirect URI:', finalRedirectUri);
    console.log('Redirecting to Google OAuth with URL:', googleAuthUrl.toString());

    // Redirect to Google OAuth with proper parameters
    return NextResponse.redirect(googleAuthUrl.toString());
}