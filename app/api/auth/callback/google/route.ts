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
        let originalRedirectUri = 'http://localhost:3000'; // fallback
        let originalState = '';
        let clientType = 'unknown';

        if (stateParam) {
            try {
                const parsedState = JSON.parse(stateParam);
                originalRedirectUri = parsedState.originalRedirectUri || originalRedirectUri;
                originalState = parsedState.originalState || '';

                // Detect client type based on redirect URI pattern
                if (originalRedirectUri.includes('oauth/callback')) {
                    clientType = 'claude-desktop';
                } else if (originalRedirectUri.includes('vscode-generated')) {
                    clientType = 'vscode';
                } else {
                    clientType = 'generic';
                }
            } catch (e) {
                console.log('Could not parse state, using as-is');
                originalState = stateParam;
            }
        }

        console.log('Client details:', {
            type: clientType,
            originalRedirectUri,
            originalState
        });

        // Exchange authorization code for tokens
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
                redirect_uri: 'http://localhost:3000/api/auth/callback/google',
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

        // Build the redirect URL back to the client with the appropriate token
        const clientRedirectUrl = new URL(originalRedirectUri);

        if (tokens.id_token) {
            // Different clients expect different token formats
            if (clientType === 'claude-desktop') {
                // Claude Desktop typically expects access tokens
                clientRedirectUrl.searchParams.set('access_token', tokens.access_token);
                clientRedirectUrl.searchParams.set('id_token', tokens.id_token);
                clientRedirectUrl.searchParams.set('token_type', 'Bearer');
                console.log('Adding both access and ID tokens for Claude Desktop');
            } else {
                // VS Code and others expect ID token as access_token parameter
                clientRedirectUrl.searchParams.set('access_token', tokens.id_token);
                clientRedirectUrl.searchParams.set('token_type', 'Bearer');
                console.log('Adding ID token as access_token for VS Code/generic client');
            }

            if (tokens.expires_in) {
                clientRedirectUrl.searchParams.set('expires_in', tokens.expires_in.toString());
            }

            console.log('Token is JWT format:', tokens.id_token.split('.').length === 3);
        } else {
            console.error('No ID token received from Google');
            console.log('Available tokens:', Object.keys(tokens));
            clientRedirectUrl.searchParams.set('error', 'no_id_token');
            clientRedirectUrl.searchParams.set('error_description', 'No ID token received from Google');
        }

        if (originalState) {
            clientRedirectUrl.searchParams.set('state', originalState);
        }

        console.log(`Final ${clientType} redirect URL (token masked):`,
            clientRedirectUrl.toString().replace(tokens.id_token || '', '[ID_TOKEN_MASKED]')
                .replace(tokens.access_token || '', '[ACCESS_TOKEN_MASKED]'));

        // Redirect back to the client with the appropriate tokens
        return NextResponse.redirect(clientRedirectUrl.toString());

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