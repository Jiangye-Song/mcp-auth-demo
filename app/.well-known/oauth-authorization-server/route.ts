/**
 * OAuth 2.1 Authorization Server Metadata endpoint (RFC 8414)
 *
 * This endpoint provides information about our OAuth 2.1 authorization server
 * capabilities, including dynamic client registration support.
 *
 * OAuth 2.1 Compliance: Only supports authorization code flow with query parameters.
 * Hash fragment patterns and implicit flow are not supported.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8414
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1
 */

import { resolveApiDomain } from "../../../lib/url-resolver";

export async function GET(_req: Request) {
  const baseUrl = resolveApiDomain();

  const metadata = {
    // Authorization server identifier
    issuer: baseUrl,

    // Authorization endpoint - use our custom endpoint
    authorization_endpoint: `${baseUrl}/api/auth/authorize`,

    // Token endpoint - use our custom endpoint for VS Code compatibility
    token_endpoint: `${baseUrl}/api/auth/token`,

    // Dynamic client registration endpoint - our custom endpoint
    registration_endpoint: `${baseUrl}/api/auth/register`,

    // Supported scopes
    scopes_supported: ["openid", "email", "profile"],

    // Supported response types (OAuth 2.1 - authorization code only)
    response_types_supported: ["code"],

    // Supported response modes (OAuth 2.1 - query parameters only)
    response_modes_supported: ["query"],

    // Supported grant types (OAuth 2.1 - authorization code only)
    grant_types_supported: ["authorization_code"],

    // OAuth 2.1 compliance indicator
    oauth_compliance_version: "OAuth 2.1",

    // OAuth 2.1 security requirements
    require_request_uri_registration: false,
    require_signed_request_object: false,

    // Token endpoint authentication methods
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "client_secret_basic",
    ],

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
      "exp",
    ],

    // UserInfo endpoint
    userinfo_endpoint: "https://www.googleapis.com/oauth2/v2/userinfo",

    // JWKS URI (Google's)
    jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",

    // Code challenge methods supported
    code_challenge_methods_supported: ["S256", "plain"],

    // Additional metadata
    service_documentation:
      "https://developers.google.com/identity/protocols/oauth2",

    // Cache busting
    updated_at: new Date().toISOString(),
  };

  console.log("Authorization server metadata requested");

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

export async function OPTIONS(_req: Request) {
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
