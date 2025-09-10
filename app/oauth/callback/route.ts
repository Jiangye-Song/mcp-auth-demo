import { NextRequest, NextResponse } from 'next/server';

/**
 * Claude Desktop OAuth callback endpoint
 * This handles the OAuth callback for Claude Desktop which expects /oauth/callback
 */
export async function GET(request: NextRequest) {
    console.log('🎯 OAUTH CALLBACK HIT 🎯 - ', new Date().toISOString());

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
    console.log('Full URL:', request.url);

    if (error) {
        console.error('OAuth error:', error);
        return NextResponse.json({ error, error_description: 'OAuth authorization failed' }, { status: 400 });
    }

    if (!code) {
        console.error('No authorization code received');
        return NextResponse.json({ error: 'invalid_request', error_description: 'No authorization code received' }, { status: 400 });
    }

    // Check if this is a manual test vs mcp-remote
    const isManualTest = stateParam?.includes('{') || stateParam?.includes('manual-test') || stateParam?.includes('simple-test');

    if (isManualTest) {
        console.log('Manual test detected, performing token exchange');

        // Parse state to get code verifier for PKCE
        let codeVerifier = '';
        try {
            if (stateParam) {
                const stateData = JSON.parse(stateParam);
                codeVerifier = stateData.codeVerifier || '';
            }
        } catch (e) {
            console.log('Could not parse state as JSON');
        }

        // Perform token exchange for manual tests
        const tokenRequestBody = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: `${url.origin}/oauth/callback`,
        });

        if (codeVerifier) {
            tokenRequestBody.append('code_verifier', codeVerifier);
            console.log('Added code_verifier for PKCE flow');
        }

        try {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: tokenRequestBody,
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
            console.log('✅ Manual test token exchange successful');

            return NextResponse.json({
                access_token: tokens.access_token,
                id_token: tokens.id_token,
                refresh_token: tokens.refresh_token,
                token_type: 'Bearer',
                expires_in: tokens.expires_in,
                scope: 'openid email profile',
                state: stateParam
            });
        } catch (err) {
            console.error('Token exchange error:', err);
            return NextResponse.json({
                error: 'token_exchange_failed',
                details: err instanceof Error ? err.message : String(err)
            }, { status: 500 });
        }
    } else {
        console.log('MCP-Remote detected, returning authorization code for client-side token exchange');

        // For mcp-remote, just return success - it will handle token exchange itself
        return NextResponse.json({
            code: code,
            state: stateParam,
            status: 'authorization_successful'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }
}

export async function POST(request: NextRequest) {
    // Handle POST requests for Claude Desktop if needed
    return GET(request);
}

export async function OPTIONS(request: NextRequest) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        },
    });
}