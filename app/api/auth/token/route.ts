import { NextRequest, NextResponse } from 'next/server';

/**
 * Custom OAuth token endpoint that handles token exchange for mcp-remote
 * This endpoint receives token exchange requests from mcp-remote and forwards them
 * to Google OAuth with the correct redirect_uri parameter
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const tokenParams = new URLSearchParams(body);

        console.log('Token exchange request received:', {
            grant_type: tokenParams.get('grant_type'),
            code: tokenParams.get('code') ? `${tokenParams.get('code')?.substring(0, 20)}...` : 'missing',
            redirect_uri: tokenParams.get('redirect_uri'),
            code_verifier: tokenParams.get('code_verifier') ? 'present' : 'missing',
            client_id: tokenParams.get('client_id') ? 'present' : 'missing'
        });

        // Get the production URL from Vercel environment or construct from request
        const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : new URL(request.url).origin;

        // Create the token request for Google OAuth
        const googleTokenParams = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            code: tokenParams.get('code') || '',
            grant_type: 'authorization_code',
            // Use our production server redirect_uri (the one used in authorization)
            redirect_uri: `${productionUrl}/oauth/callback`,
        });

        // Add PKCE code_verifier if provided
        const codeVerifier = tokenParams.get('code_verifier');
        if (codeVerifier) {
            googleTokenParams.append('code_verifier', codeVerifier);
            console.log('Added code_verifier for PKCE flow');
        }

        console.log('Forwarding token exchange to Google OAuth with:', {
            client_id: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
            redirect_uri: `${productionUrl}/oauth/callback`,
            code_present: !!tokenParams.get('code'),
            code_verifier_present: !!codeVerifier
        });

        // Exchange the authorization code with Google OAuth
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: googleTokenParams,
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Google token exchange failed:', errorData);

            return new Response(errorData, {
                status: tokenResponse.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        const tokens = await tokenResponse.json();
        console.log('✅ Token exchange successful');

        // Return the tokens to mcp-remote
        return new Response(JSON.stringify(tokens), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });

    } catch (error) {
        console.error('Token exchange error:', error);

        return new Response(JSON.stringify({
            error: 'token_exchange_failed',
            error_description: 'Failed to exchange authorization code for tokens',
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
}

export async function OPTIONS(request: NextRequest) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        },
    });
}