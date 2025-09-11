import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    console.log('🔥 OAUTH CALLBACK HIT 🔥 - ', new Date().toISOString());

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Get OAuth response parameters
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const stateParam = searchParams.get('state');

    console.log('OAuth callback received:');
    console.log('Code:', code ? 'present' : 'missing');
    console.log('Error:', error);
    console.log('State:', stateParam);

    if (error) {
        console.error('OAuth error:', error);
        return NextResponse.json({ error, error_description: 'OAuth authorization failed' }, { status: 400 });
    }

    if (!code) {
        console.error('No authorization code received');
        return NextResponse.json({ error: 'invalid_request', error_description: 'No authorization code received' }, { status: 400 });
    }

    try {
        // Parse the extended state to get client's original redirect URI
        let originalRedirectUri = 'http://localhost:3001'; // fallback
        let originalState = '';
        let clientType = 'unknown';

        if (stateParam) {
            try {
                console.log('Raw state parameter:', stateParam);
                console.log('Attempting to decode base64url state...');

                // Decode base64url-encoded state
                const decodedState = Buffer.from(stateParam, 'base64url').toString('utf-8');
                console.log('Decoded state:', decodedState);

                const parsedState = JSON.parse(decodedState);
                console.log('Parsed state object:', parsedState);

                originalRedirectUri = parsedState.originalRedirectUri || originalRedirectUri;
                originalState = parsedState.originalState || '';

                // Detect client type based on redirect URI pattern
                if (originalRedirectUri.includes('oauth/callback')) {
                    clientType = 'claude-desktop';
                } else if (originalRedirectUri.includes('vscode.dev/redirect')) {
                    clientType = 'vscode-web';
                } else if (originalRedirectUri.startsWith('http://127.0.0.1:') ||
                    originalRedirectUri.startsWith('http://localhost:')) {
                    clientType = 'vscode-local'; // VS Code's temporary OAuth server
                } else {
                    clientType = 'generic';
                }

                console.log('Detected client type:', clientType);
            } catch (e) {
                console.log('Could not decode/parse state, trying direct JSON parse...');
                try {
                    const parsedState = JSON.parse(stateParam);
                    originalRedirectUri = parsedState.originalRedirectUri || originalRedirectUri;
                    originalState = parsedState.originalState || '';
                    clientType = 'legacy-format';
                } catch (e2) {
                    console.log('Parse error:', e);
                    originalState = stateParam;
                    clientType = 'fallback';
                }
            }
        }

        console.log('Client details:', {
            type: clientType,
            originalRedirectUri,
            originalState
        });

        // Exchange authorization code for tokens
        // Use the same redirect URI that was used in the authorization request
        const currentOrigin = new URL(request.url).origin;
        const redirectUriForTokenExchange = `${currentOrigin}/api/auth/callback/google`;

        console.log('Using redirect URI for token exchange:', redirectUriForTokenExchange);

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUriForTokenExchange,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Token exchange failed:', errorData);
            return NextResponse.json({
                error: 'token_exchange_failed',
                error_description: 'Failed to exchange authorization code for tokens',
                details: errorData
            }, { status: 500 });
        }

        const tokens = await tokenResponse.json();
        console.log('=== TOKEN EXCHANGE RESPONSE ===');
        console.log('Token exchange successful, received:', Object.keys(tokens));
        console.log('ID token present:', !!tokens.id_token);
        console.log('Access token present:', !!tokens.access_token);
        console.log('Refresh token present:', !!tokens.refresh_token);
        console.log('ID token length:', tokens.id_token?.length || 0);
        console.log('Access token length:', tokens.access_token?.length || 0);
        console.log('ID token preview:', tokens.id_token ? `${tokens.id_token.substring(0, 50)}...` : 'none');
        console.log('Access token preview:', tokens.access_token ? `${tokens.access_token.substring(0, 50)}...` : 'none');
        console.log('ID token segments:', tokens.id_token ? tokens.id_token.split('.').length : 0);
        console.log('===============================');

        // Store Google tokens with our authorization code for later exchange
        let authCode = '';
        if (stateParam) {
            try {
                const decodedState = Buffer.from(stateParam, 'base64url').toString('utf-8');
                const parsedState = JSON.parse(decodedState);
                authCode = parsedState.authCode || '';

                // Update our stored authorization code with the Google tokens
                if (authCode && (globalThis as any).authCodes) {
                    const authData = (globalThis as any).authCodes.get(authCode);
                    if (authData) {
                        authData.googleTokens = tokens;
                        (globalThis as any).authCodes.set(authCode, authData);
                        console.log('✅ Stored Google tokens with authorization code:', authCode);
                    }
                }
            } catch (e) {
                console.log('Could not extract/update auth code from state');
            }
        }

        // Build the redirect URL back to the client with the appropriate token
        let finalRedirectUrl: string;

        console.log('=== REDIRECT URL CONSTRUCTION ===');
        console.log('Client type:', clientType);
        console.log('Original redirect URI:', originalRedirectUri);
        console.log('Original state:', originalState);

        if (tokens.id_token) {
            if (clientType === 'claude-desktop') {
                // Claude Desktop uses query parameters
                const clientRedirectUrl = new URL(originalRedirectUri);
                clientRedirectUrl.searchParams.set('access_token', tokens.access_token);
                clientRedirectUrl.searchParams.set('id_token', tokens.id_token);
                clientRedirectUrl.searchParams.set('token_type', 'Bearer');
                if (tokens.expires_in) {
                    clientRedirectUrl.searchParams.set('expires_in', tokens.expires_in.toString());
                }
                if (originalState) {
                    clientRedirectUrl.searchParams.set('state', originalState);
                }
                finalRedirectUrl = clientRedirectUrl.toString();
                console.log('Using query parameters for Claude Desktop');
            } else if (clientType === 'vscode-web' && originalRedirectUri === 'https://vscode.dev/redirect') {
                // VS Code web redirect - use vscode.dev redirect with parameters
                console.log('Processing VS Code web redirect');

                // Use vscode.dev redirect URL with query parameters (VS Code expects this format)
                const vsCodeRedirectUrl = new URL('https://vscode.dev/redirect');

                // Add VS Code callback parameters
                vsCodeRedirectUrl.searchParams.set('vscode-scheme', 'vscode');
                vsCodeRedirectUrl.searchParams.set('vscode-authority', 'ms-vscode.vscode-mcp');
                vsCodeRedirectUrl.searchParams.set('vscode-path', '/oauth-callback');
                vsCodeRedirectUrl.searchParams.set('access_token', tokens.id_token);
                vsCodeRedirectUrl.searchParams.set('token_type', 'Bearer');
                vsCodeRedirectUrl.searchParams.set('expires_in', tokens.expires_in?.toString() || '3600');

                if (originalState) {
                    vsCodeRedirectUrl.searchParams.set('state', originalState);
                }

                finalRedirectUrl = vsCodeRedirectUrl.toString();
                console.log('Using VS Code web redirect with protocol parameters');
            } else if (clientType === 'vscode-local' && originalRedirectUri.startsWith('http://127.0.0.1:')) {
                // VS Code local server - use authorization code flow (VS Code expects this)
                const baseUrl = originalRedirectUri.split('#')[0].split('?')[0];
                const vsCodeUrl = new URL(baseUrl);

                // Extract our stored authorization code from parsed state
                let authCode = '';
                if (stateParam) {
                    try {
                        const decodedState = Buffer.from(stateParam, 'base64url').toString('utf-8');
                        const parsedState = JSON.parse(decodedState);
                        authCode = parsedState.authCode || '';
                        console.log('Retrieved stored auth code:', authCode);
                    } catch (e) {
                        console.log('Could not extract auth code from state');
                    }
                }

                // Return our authorization code (not Google's) - VS Code will exchange it with our token endpoint
                if (authCode) {
                    vsCodeUrl.searchParams.set('code', authCode);
                } else {
                    // Fallback: use Google's code directly
                    vsCodeUrl.searchParams.set('code', code);
                }

                if (originalState && originalState.trim() !== '') {
                    vsCodeUrl.searchParams.set('state', originalState);
                }

                finalRedirectUrl = vsCodeUrl.toString();
                console.log('Using authorization code flow for VS Code local server');
                console.log('VS Code redirect URI preserved:', baseUrl);
                console.log('Returning authorization code for VS Code to exchange:', authCode || code);
            } else {
                // ALL other clients use URL fragments (fallback behavior)
                const baseUrl = originalRedirectUri.split('#')[0].split('?')[0];

                const tokenParams = new URLSearchParams({
                    access_token: tokens.id_token,
                    token_type: 'Bearer',
                    expires_in: tokens.expires_in?.toString() || '3600'
                });

                // Only add state if it exists and is not empty
                if (originalState && originalState.trim() !== '') {
                    tokenParams.set('state', originalState);
                }

                finalRedirectUrl = `${baseUrl}#${tokenParams.toString()}`;
                console.log(`Using URL fragments for ${clientType} client`);
            }

            console.log('Token is JWT format:', tokens.id_token.split('.').length === 3);
            console.log('State being returned:', originalState);
        } else {
            console.error('No ID token received from Google');
            console.log('Available tokens:', Object.keys(tokens));

            const baseUrl = originalRedirectUri.split('#')[0].split('?')[0];
            const errorParams = new URLSearchParams({
                error: 'no_id_token',
                error_description: 'No ID token received from Google'
            });
            finalRedirectUrl = `${baseUrl}#${errorParams.toString()}`;
        }

        console.log('==================================');

        console.log(`Final ${clientType} redirect URL (token masked):`,
            finalRedirectUrl.replace(tokens.id_token || '', '[ID_TOKEN_MASKED]')
                .replace(tokens.access_token || '', '[ACCESS_TOKEN_MASKED]'));

        // Redirect back to the client with the appropriate tokens
        return NextResponse.redirect(finalRedirectUrl);

    } catch (err) {
        console.error('Error in OAuth callback:', err);

        // Return error information as JSON for debugging
        return NextResponse.json({
            error: 'callback_error',
            message: 'Error processing OAuth callback',
            details: err instanceof Error ? err.message : String(err),
            received: {
                code: code ? 'present' : 'missing',
                error,
                state: stateParam
            }
        }, { status: 500 });
    }
} export async function POST(request: NextRequest) {
    const body = await request.text();

    console.log('OAuth callback POST received:');
    console.log('URL:', request.url);
    console.log('Body:', body);
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    return NextResponse.json({
        message: 'OAuth callback POST received',
        url: request.url,
        body,
        headers: Object.fromEntries(request.headers.entries())
    });
}