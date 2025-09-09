import { OAuth2Client } from 'google-auth-library';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

/**
 * Google OAuth 2.0 client for token verification
 */
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google ID token and return authentication information
 * 
 * @param req - The incoming request (unused but required by interface)
 * @param bearerToken - The bearer token from Authorization header
 * @returns AuthInfo object if token is valid, undefined otherwise
 */
export async function verifyGoogleToken(
    req: Request,
    bearerToken?: string
): Promise<AuthInfo | undefined> {
    console.log('=== TOKEN VERIFICATION ===');
    console.log('Bearer token provided:', !!bearerToken);
    console.log('Token length:', bearerToken?.length || 0);
    console.log('Token preview:', bearerToken ? `${bearerToken.substring(0, 50)}...` : 'none');
    console.log('Request URL:', req.url);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    console.log('===========================');

    if (!bearerToken) {
        console.log('No bearer token provided');
        return undefined;
    }

    try {
        console.log('Verifying Google ID token...');

        // Check if this is a JWT (ID token) or an access token
        const tokenSegments = bearerToken.split('.');

        if (tokenSegments.length === 3) {
            // This is a JWT ID token - use the existing verification method
            console.log('Token appears to be a JWT ID token');

            const ticket = await googleClient.verifyIdToken({
                idToken: bearerToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload) {
                console.log('Token payload is empty');
                return undefined;
            }

            console.log('ID token verified successfully for user:', payload.email);

            return {
                token: bearerToken,
                scopes: ['read:mcp', 'write:mcp'], // Define your application scopes
                clientId: payload.sub, // Google user ID (unique identifier)
                expiresAt: payload.exp, // Token expiration timestamp
                extra: {
                    // Additional user information from Google
                    email: payload.email,
                    name: payload.name,
                    picture: payload.picture,
                    verified: payload.email_verified,
                    domain: payload.hd, // G Suite domain (if applicable)
                    locale: payload.locale,
                },
            };
        } else {
            // This appears to be an access token - use Google's UserInfo API
            console.log('Token appears to be an access token, using UserInfo API');

            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${bearerToken}`
                }
            });

            if (!userInfoResponse.ok) {
                console.log('UserInfo API call failed:', userInfoResponse.status, userInfoResponse.statusText);
                return undefined;
            }

            const userInfo = await userInfoResponse.json();
            console.log('Access token verified successfully for user:', userInfo.email);

            return {
                token: bearerToken,
                scopes: ['read:mcp', 'write:mcp'], // Define your application scopes
                clientId: userInfo.id, // Google user ID
                expiresAt: undefined, // Access tokens don't have expiration in the token itself
                extra: {
                    // Additional user information from Google UserInfo API
                    email: userInfo.email,
                    name: userInfo.name,
                    picture: userInfo.picture,
                    verified: userInfo.verified_email,
                    locale: userInfo.locale,
                },
            };
        }
    } catch (error) {
        console.error('Google token verification failed:', error);
        return undefined;
    }
}

/**
 * Helper function to get user info from auth context
 * 
 * @param authInfo - AuthInfo object from token verification
 * @returns Formatted user information string
 */
export function formatUserInfo(authInfo?: AuthInfo): string {
    if (!authInfo?.extra) return '';

    const email = authInfo.extra.email;
    const name = authInfo.extra.name;

    if (name && email) {
        return ` (authenticated as ${name} <${email}>)`;
    } else if (email) {
        return ` (authenticated as ${email})`;
    } else if (name) {
        return ` (authenticated as ${name})`;
    }

    return ` (authenticated user)`;
}