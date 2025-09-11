// OAuth Authorization Server Metadata (RFC 8414) - OAuth 2.1 + MCP 2025-06-18 Compliant
export async function GET(request: Request) {
    const baseUrl = process.env.OAUTH_ISSUER || new URL(request.url).origin;

    const metadata = {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/api/auth/authorize`,
        token_endpoint: `${baseUrl}/api/auth/token`,
        registration_endpoint: `${baseUrl}/api/auth/register`,

        // OAuth 2.1 Compliance (MCP 2025-06-18 REQUIRED)
        response_types_supported: ['code'], // Only authorization code flow allowed
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'], // PKCE mandatory
        token_endpoint_auth_methods_supported: ['none'], // Public client support

        // OAuth 2.1 + MCP Specific Features
        scopes_supported: ['openid', 'profile', 'email', 'mcp:read', 'mcp:write', 'mcp:tools'],

        // MCP 2025-06-18 Required Fields
        resource_indicator_supported: true, // RFC 8707 support
        require_pushed_authorization_requests: false,
        pushed_authorization_request_endpoint: null,
        revocation_endpoint: `${baseUrl}/api/auth/revoke`,
        introspection_endpoint: `${baseUrl}/api/auth/introspect`,

        // Additional OAuth 2.1 Security Features
        authorization_response_iss_parameter_supported: true,
        backchannel_logout_supported: false,
        frontchannel_logout_supported: false,

        // MCP-specific metadata
        mcp_version: '2025-06-18',
        oauth_version: '2.1',
        protected_resource_metadata_endpoint: `${baseUrl}/.well-known/oauth-protected-resource`
    };

    console.log('🔍 OAuth Authorization Server Metadata requested');
    console.log('OAuth 2.1 Compliance: ENABLED');
    console.log('MCP 2025-06-18 Compliance: ENABLED');
    console.log('Base URL:', baseUrl);

    return Response.json(metadata, {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}