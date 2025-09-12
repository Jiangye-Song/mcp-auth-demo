import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { resolveApiDomain } from '../../../../lib/url-resolver';

/**
 * OAuth 2.1 Token Endpoint for VS Code MCP Authentication
 * Implements authorization code exchange with PKCE verification
 */
export async function POST(request: NextRequest) {
    console.log('🔑 Token Exchange Request - ', new Date().toISOString());

    try {
        const body = await request.text();
        const params = new URLSearchParams(body);

        // Extract token request parameters
        const grantType = params.get('grant_type');
        const code = params.get('code');
        const redirectUri = params.get('redirect_uri');
        const clientId = params.get('client_id');
        const codeVerifier = params.get('code_verifier');

        console.log('Token request parameters:');
        console.log('Grant Type:', grantType);
        console.log('Code:', code ? 'present' : 'missing');
        console.log('Redirect URI:', redirectUri);
        console.log('Client ID:', clientId);
        console.log('Code Verifier:', codeVerifier ? 'present' : 'missing');

        // Validate grant type
        if (grantType !== 'authorization_code') {
            console.log('❌ Invalid grant_type');
            return NextResponse.json({
                error: 'unsupported_grant_type',
                error_description: 'Only authorization_code grant type is supported'
            }, { status: 400 });
        }

        // Validate required parameters
        if (!code) {
            console.log('❌ Missing authorization code');
            return NextResponse.json({
                error: 'invalid_request',
                error_description: 'Missing authorization code'
            }, { status: 400 });
        }

        if (!redirectUri) {
            console.log('❌ Missing redirect_uri');
            return NextResponse.json({
                error: 'invalid_request',
                error_description: 'Missing redirect_uri'
            }, { status: 400 });
        }

        // Retrieve stored authorization code data
        const authCodes = (globalThis as any).authCodes || new Map();
        const authData = authCodes.get(code);

        if (!authData) {
            console.log('❌ Invalid or expired authorization code');
            return NextResponse.json({
                error: 'invalid_grant',
                error_description: 'Invalid or expired authorization code'
            }, { status: 400 });
        }

        // Check if code has expired (10 minutes)
        if (Date.now() > authData.expiresAt) {
            console.log('❌ Authorization code expired');
            authCodes.delete(code);
            return NextResponse.json({
                error: 'invalid_grant',
                error_description: 'Authorization code expired'
            }, { status: 400 });
        }

        // Validate redirect URI matches (normalize localhost vs 127.0.0.1 for OAuth 2.1 compatibility)
        const normalizeRedirectUri = (uri: string) => {
            return uri.replace('127.0.0.1', 'localhost').replace(/\/$/, '').toLowerCase();
        };

        const normalizedStoredUri = normalizeRedirectUri(authData.redirectUri);
        const normalizedRequestUri = normalizeRedirectUri(redirectUri);

        if (normalizedStoredUri !== normalizedRequestUri) {
            console.log('❌ Redirect URI mismatch');
            console.log('Stored (normalized):', normalizedStoredUri);
            console.log('Request (normalized):', normalizedRequestUri);
            return NextResponse.json({
                error: 'invalid_grant',
                error_description: 'Redirect URI does not match'
            }, { status: 400 });
        }

        // Validate client ID if provided
        if (clientId && authData.clientId !== clientId) {
            console.log('❌ Client ID mismatch');
            return NextResponse.json({
                error: 'invalid_client',
                error_description: 'Client ID does not match'
            }, { status: 400 });
        }

        // PKCE verification if code challenge was provided
        if (authData.codeChallenge) {
            if (!codeVerifier) {
                console.log('❌ Missing code verifier for PKCE');
                return NextResponse.json({
                    error: 'invalid_request',
                    error_description: 'Code verifier required for PKCE'
                }, { status: 400 });
            }

            // Verify PKCE S256
            const computedChallenge = createHash('sha256')
                .update(codeVerifier)
                .digest('base64url');

            if (computedChallenge !== authData.codeChallenge) {
                console.log('❌ PKCE verification failed');
                return NextResponse.json({
                    error: 'invalid_grant',
                    error_description: 'PKCE verification failed'
                }, { status: 400 });
            }

            console.log('✅ PKCE verification successful');
        }

        // Check if we have stored Google tokens for this authorization code
        if (authData.googleTokens) {
            console.log('✅ Using stored Google tokens for authorization code');
            const googleTokens = authData.googleTokens;

            // Clean up used authorization code
            authCodes.delete(code);

            // Return OAuth 2.1 compliant token response
            const tokenResponseData: any = {
                access_token: googleTokens.id_token || googleTokens.access_token,
                token_type: 'Bearer',
                expires_in: googleTokens.expires_in || 3600,
                scope: authData.scope || 'openid profile email'
            };

            // Include refresh token if available
            if (googleTokens.refresh_token) {
                tokenResponseData.refresh_token = googleTokens.refresh_token;
            }

            // Include ID token if available (for OpenID Connect)
            if (googleTokens.id_token) {
                tokenResponseData.id_token = googleTokens.id_token;
            }

            console.log('🎉 Token exchange completed successfully (stored tokens)');
            console.log('Scope:', tokenResponseData.scope);
            console.log('Expires in:', tokenResponseData.expires_in);

            return NextResponse.json(tokenResponseData);
        }

        // Fallback: Exchange authorization code for Google tokens (shouldn't happen with new flow)
        console.log('⚠️ No stored tokens - attempting direct Google exchange (fallback)');

        // Exchange authorization code for Google tokens
        console.log('🔄 Exchanging authorization code with Google...');

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
                redirect_uri: `${resolveApiDomain()}/api/auth/callback/google`,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('❌ Google token exchange failed:', errorData);
            return NextResponse.json({
                error: 'server_error',
                error_description: 'Failed to exchange authorization code with Google',
                details: errorData
            }, { status: 500 });
        }

        const googleTokens = await tokenResponse.json();
        console.log('✅ Google token exchange successful');
        console.log('Received tokens:', Object.keys(googleTokens));

        // Clean up used authorization code
        authCodes.delete(code);

        // Return OAuth 2.1 compliant token response
        const tokenResponseData: any = {
            access_token: googleTokens.id_token || googleTokens.access_token,
            token_type: 'Bearer',
            expires_in: googleTokens.expires_in || 3600,
            scope: authData.scope || 'openid profile email'
        };

        // Include refresh token if available
        if (googleTokens.refresh_token) {
            tokenResponseData.refresh_token = googleTokens.refresh_token;
        }

        // Include ID token if available (for OpenID Connect)
        if (googleTokens.id_token) {
            tokenResponseData.id_token = googleTokens.id_token;
        }

        console.log('🎉 Token exchange completed successfully');
        console.log('Scope:', tokenResponseData.scope);
        console.log('Expires in:', tokenResponseData.expires_in);

        return NextResponse.json(tokenResponseData);

    } catch (error) {
        console.error('❌ Error in token endpoint:', error);
        return NextResponse.json({
            error: 'server_error',
            error_description: 'Internal server error during token exchange',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

// Handle preflight OPTIONS requests
export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}