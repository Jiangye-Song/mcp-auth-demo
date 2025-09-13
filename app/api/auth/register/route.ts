import { CORS_CONFIGS, createOPTIONSResponse } from "@/lib/oauth-utils";
import { resolveApiDomain } from "@/lib/url-resolver";

/**
 * OAuth 2.0 Dynamic Client Registration endpoint (RFC 7591)
 *
 * This endpoint allows MCP clients like Claude Desktop to dynamically register
 * themselves as OAuth clients. Since we're using Google OAuth, we return our
 * pre-configured Google OAuth client credentials.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7591
 */

export async function POST(req: Request) {
  try {
    const registrationRequest = await req.json();

    // Use the redirect URIs provided by the client, with fallbacks
    const clientRedirectUris = registrationRequest.redirect_uris || [];

    // Get the base URL using url-resolver
    const baseUrl = resolveApiDomain();

    const baseRedirectUris = [
      `${baseUrl}/api/auth/callback/google`,
      `${baseUrl}/oauth/callback`,
    ];

    // **FIX FOR MCP-REMOTE COMPATIBILITY**
    // Include both server URIs (for Google OAuth) AND client localhost URIs (for mcp-remote port detection)
    // This allows mcp-remote to find the localhost URI it expects while we still proxy through our server
    const allRedirectUris = [
      ...baseRedirectUris, // Our production server's callback URIs (registered in Google)
      ...clientRedirectUris.filter(
        (uri: string) => uri.includes("localhost") || uri.includes("127.0.0.1"),
      ), // Include client's localhost URIs for mcp-remote compatibility
    ];

    // For MCP clients, we return our pre-configured Google OAuth client
    // In a real dynamic registration scenario, we would create new clients
    // But since we're using Google OAuth, we use our existing client
    const clientRegistration = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0, // Never expires for Google OAuth
      redirect_uris: allRedirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
      scope: "openid email profile",
      // MCP-specific metadata
      application_type: "native",
      client_name: registrationRequest.client_name || "MCP Client",
      client_uri: registrationRequest.client_uri,
      // Return the authorization server endpoints
      authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      // Use our custom token endpoint that handles redirect_uri correctly
      token_endpoint: `${baseUrl}/api/auth/token`,
      userinfo_endpoint: "https://www.googleapis.com/oauth2/v2/userinfo",
    };

    // Check if we have the required environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error("Missing required environment variables:", {
        GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      });

      return new Response(
        JSON.stringify({
          error: "server_error",
          error_description: "OAuth client credentials not configured",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    console.log("Dynamic client registration request:", {
      clientName: registrationRequest.client_name,
      clientUri: registrationRequest.client_uri,
      redirectUris: registrationRequest.redirect_uris,
    });

    console.log("Environment variables check:", {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      googleClientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
      // Only log first few chars for security
      googleClientIdPreview:
        `${process.env.GOOGLE_CLIENT_ID?.substring(0, 10)}...` || "undefined",
    });

    return new Response(JSON.stringify(clientRegistration), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("Client registration error:", error);

    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "Invalid client registration request",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export async function OPTIONS(_req: Request) {
  return createOPTIONSResponse(CORS_CONFIGS.api);
}
