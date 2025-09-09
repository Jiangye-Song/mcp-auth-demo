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
        userAgent: request.headers.get('user-agent')
    });

    // Store the original redirect URI (client's dynamic port) in the state parameter
    // so we can redirect back to it after OAuth completes
    const extendedState = JSON.stringify({
        originalState: state,
        originalRedirectUri: originalRedirectUri
    });

    // Use our fixed redirect URI that's configured in Google Console
    const fixedRedirectUri = 'http://localhost:3000/api/auth/callback/google';

    // Ensure we always include the required scope parameter
    const scope = 'openid email profile';

    // Build the Google OAuth authorization URL with all required parameters
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId!);
    googleAuthUrl.searchParams.set('redirect_uri', fixedRedirectUri);
    googleAuthUrl.searchParams.set('response_type', responseType);
    googleAuthUrl.searchParams.set('scope', scope);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');
    googleAuthUrl.searchParams.set('state', extendedState);

    console.log('Client redirect URI:', originalRedirectUri);
    console.log('Using fixed redirect URI:', fixedRedirectUri);
    console.log('Redirecting to Google OAuth with URL:', googleAuthUrl.toString());

    // Redirect to Google OAuth with proper parameters
    return NextResponse.redirect(googleAuthUrl.toString());
}