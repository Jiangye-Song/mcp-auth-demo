import { generateProtectedResourceMetadata } from "mcp-handler";
import { resolveApiDomain } from "@/lib/url-resolver";

/**
 * OAuth 2.0 Protected Resource Metadata endpoint (RFC 9728)
 *
 * This endpoint provides information about our MCP server's authentication
 * requirements to clients. It specifies that Google is our authorization server
 * and that our MCP resource is at /api/mcp.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 */
function handler(_req: Request) {
  // Get the base URL using url-resolver
  const baseUrl = resolveApiDomain();

  // Our MCP server resource is at /api/mcp
  const resourceUrl = `${baseUrl}/api/mcp`;

  // Generate metadata with the correct resource URL and our authorization server
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [`${baseUrl}`], // Use our own authorization server
    resourceUrl,
    additionalMetadata: {
      // Add OAuth 2.0 scopes that clients should request
      scopes_supported: ["openid", "email", "profile"],
      // Point to our authorization server metadata
      authorization_server: `${baseUrl}/.well-known/oauth-authorization-server`,
      // Add token endpoint information
      token_endpoint: "https://oauth2.googleapis.com/token",
      // Use our custom authorization endpoint that ensures proper scope parameter
      authorization_endpoint: `${baseUrl}/api/auth/authorize`,
      // Add dynamic client registration endpoint (RFC 7591)
      registration_endpoint: `${baseUrl}/api/auth/register`,
      // Specify that we support dynamic client registration
      registration_endpoint_auth_methods_supported: ["none"],
      // Specify that we use bearer tokens
      bearer_methods_supported: ["header"],
      // Specify supported grant types
      grant_types_supported: ["authorization_code"],
      // Specify supported response types
      response_types_supported: ["code"],
      // Add client ID for reference
      client_id:
        "228760319328-g2tmjubea6q0ftpuuuab6p23647eht53.apps.googleusercontent.com",
      // Add cache busting timestamp to force refresh
      updated_at: new Date().toISOString(),
    },
  });

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  };

  return new Response(JSON.stringify(metadata), {
    headers: {
      ...corsHeaders,
      "Cache-Control": "max-age=3600",
      "Content-Type": "application/json",
    },
  });
}

function optionsHandler() {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  };

  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export { handler as GET, optionsHandler as OPTIONS };
