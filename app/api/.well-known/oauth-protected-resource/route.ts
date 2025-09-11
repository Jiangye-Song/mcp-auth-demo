// MCP OAuth 2.1 Protected Resource Metadata Endpoint (RFC 9728)
// REQUIRED by MCP Specification 2025-06-18

export async function GET(request: Request) {
    const baseUrl = new URL(request.url).origin;

    const metadata = {
        resource: baseUrl, // Canonical MCP server URI
        authorization_servers: [
            `${baseUrl}/.well-known/oauth-authorization-server`
        ],
        scopes_supported: ['mcp:read', 'mcp:write', 'mcp:tools'],
        bearer_methods_supported: ['header'], // Authorization: Bearer <token>
        resource_documentation: `${baseUrl}/docs/api`,
        // MCP-specific metadata
        mcp_version: '2025-06-18',
        transport_types: ['http'],
        oauth_version: '2.1'
    };

    console.log('🔍 Protected Resource Metadata requested');
    console.log('Base URL:', baseUrl);
    console.log('Metadata:', metadata);

    return Response.json(metadata, {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}