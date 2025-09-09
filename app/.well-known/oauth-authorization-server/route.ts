/**
 * OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414)
 * 
 * This endpoint provides information about our OAuth authorization server
 * capabilities, including dynamic client registration support.
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc8414
 */

export async function GET(req: Request) {
    const url = new URL(req.url);
    const origin = url.origin;

    const metadata = {
        // Authorization server identifier
        issuer: origin,

        // Authorization endpoint - use our custom endpoint
        authorization_endpoint: `${origin}/api/auth/authorize`,

        // Token endpoint - Google's endpoint
        token_endpoint: "https://oauth2.googleapis.com/token",

        // Dynamic client registration endpoint - our custom endpoint
        registration_endpoint: `${origin}/api/auth/register`,

        // Supported scopes
        scopes_supported: ["openid", "email", "profile"],

        // Supported response types
        response_types_supported: ["code"],

        // Supported grant types
        grant_types_supported: ["authorization_code"],

        // Token endpoint authentication methods
        token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],

        // Registration endpoint authentication methods
        registration_endpoint_auth_methods_supported: ["none"],

        // Subject types supported
        subject_types_supported: ["public"],

        // ID token signing algorithms
        id_token_signing_alg_values_supported: ["RS256"],

        // Claims supported
        claims_supported: [
            "sub",
            "email",
            "email_verified",
            "name",
            "picture",
            "aud",
            "iss",
            "iat",
            "exp"
        ],

        // UserInfo endpoint
        userinfo_endpoint: "https://www.googleapis.com/oauth2/v2/userinfo",

        // JWKS URI (Google's)
        jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",

        // Code challenge methods supported
        code_challenge_methods_supported: ["S256", "plain"],

        // Additional metadata
        service_documentation: "https://developers.google.com/identity/protocols/oauth2",

        // Cache busting
        updated_at: new Date().toISOString()
    };

    console.log('Authorization server metadata requested');

    return new Response(JSON.stringify(metadata), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "max-age=3600",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        },
    });
}

export async function OPTIONS(req: Request) {
    return new Response(null, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        },
    });
}