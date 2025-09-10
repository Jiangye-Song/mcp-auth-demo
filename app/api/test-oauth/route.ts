import { NextRequest, NextResponse } from 'next/server';

/**
 * Test Google OAuth flow with minimal parameters
 */
export async function GET(request: NextRequest) {
    console.log('🧪 Testing Google OAuth flow');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    console.log('Client ID:', clientId ? 'present' : 'missing');
    console.log('Client Secret:', clientSecret ? 'present' : 'missing');

    if (!clientId || !clientSecret) {
        return NextResponse.json({
            error: 'missing_credentials',
            message: 'Google OAuth credentials not configured'
        }, { status: 500 });
    }

    // Test with minimal OAuth parameters - just what Google requires
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', 'http://localhost:3000/oauth/callback');
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('state', 'test-state-123');

    console.log('Test OAuth URL:', googleAuthUrl.toString());

    return NextResponse.json({
        message: 'Test OAuth URL generated',
        url: googleAuthUrl.toString(),
        client_id: clientId,
        redirect_uri: 'http://localhost:3000/oauth/callback',
        instructions: 'Visit the URL above to test Google OAuth flow'
    });
}