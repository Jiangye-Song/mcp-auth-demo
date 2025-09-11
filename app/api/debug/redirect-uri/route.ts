import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/auth/callback/google`;

    return NextResponse.json({
        origin,
        redirectUri,
        googleRedirectUris: [
            'http://localhost:3000/api/auth/callback/google',
            'http://localhost:3001/api/auth/callback/google',
            'http://127.0.0.1:3000/api/auth/callback/google',
            'http://127.0.0.1:3001/api/auth/callback/google'
        ],
        message: 'These redirect URIs need to be added to Google Cloud Console',
        instructions: [
            '1. Go to Google Cloud Console',
            '2. Navigate to APIs & Services > Credentials',
            '3. Find your OAuth 2.0 Client ID',
            '4. Add all the redirectUris listed above to Authorized redirect URIs',
            '5. Save the configuration'
        ]
    });
}