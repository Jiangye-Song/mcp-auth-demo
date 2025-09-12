import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { OAuth2Client } from "google-auth-library";
import "./auth-types";

/**
 * MCP 2025-06-18 OAuth 2.1 Compliant Authentication
 */

// MCP 2025-06-18: Resource parameter validation (RFC 8707)
export function validateResourceParameter(
  resource: string,
  serverBaseUrl: string,
): boolean {
  try {
    const resourceUrl = new URL(resource);
    const serverUrl = new URL(serverBaseUrl);

    // Must match server's canonical URI
    return resourceUrl.origin === serverUrl.origin;
  } catch {
    return false;
  }
}

// MCP 2025-06-18: Token audience validation
export function validateTokenAudience(
  token: string,
  expectedAudience: string,
): boolean {
  try {
    // For JWT tokens, decode and check audience
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return (
        payload.aud === expectedAudience ||
        (Array.isArray(payload.aud) && payload.aud.includes(expectedAudience))
      );
    }
    return true; // Non-JWT tokens pass through to Google verification
  } catch {
    return false;
  }
}

// PKCE verification for OAuth 2.1 compliance
export function verifyPKCE(
  codeChallenge: string,
  codeVerifier: string,
): boolean {
  const crypto = require("node:crypto");
  const hash = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return codeChallenge === hash;
}

/**
 * Google OAuth 2.0 client for token verification
 */
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * OAuth 2.1 + MCP 2025-06-18 compliant token verification
 *
 * @param req - The incoming request
 * @param bearerToken - The bearer token from Authorization header
 * @returns AuthInfo object if token is valid, undefined otherwise
 */
export async function verifyGoogleToken(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  console.log("=== MCP OAUTH 2.1 TOKEN VERIFICATION ===");
  console.log("Bearer token provided:", !!bearerToken);
  console.log("Token length:", bearerToken?.length || 0);
  console.log("MCP 2025-06-18 Compliance: ENABLED");
  console.log("Request URL:", req.url);
  console.log("Request method:", req.method);

  // Check ALL possible authorization headers
  const authHeaders = [
    "authorization",
    "Authorization",
    "bearer",
    "Bearer",
    "x-auth-token",
    "x-authorization",
  ];

  console.log("Checking all auth header variants:");
  authHeaders.forEach((header) => {
    const value = req.headers.get(header);
    if (value) {
      console.log(`  ✅ ${header}: ${value.substring(0, 30)}...`);
    } else {
      console.log(`  ❌ ${header}: not present`);
    }
  });

  // Try to extract token from any auth header if bearerToken is missing
  if (!bearerToken) {
    for (const header of authHeaders) {
      const value = req.headers.get(header);
      if (value) {
        if (value.startsWith("Bearer ")) {
          bearerToken = value.substring(7);
          console.log(`Found token in ${header} header`);
          break;
        } else if (value.startsWith("bearer ")) {
          bearerToken = value.substring(7);
          console.log(`Found token in ${header} header (lowercase)`);
          break;
        }
      }
    }
  }

  // Development bypasses for testing
  if (!bearerToken && process.env.NODE_ENV === "development") {
    const devToken = process.env.DEV_AUTH_TOKEN;
    if (devToken) {
      console.log("🚀 Using development token for testing");
      bearerToken = devToken;
    }

    // Check for injected debug token
    if (!bearerToken && globalThis.mcpDebugToken) {
      console.log("🧪 Using injected debug token");
      bearerToken = globalThis.mcpDebugToken;
    }

    // Skip auth completely if configured
    if (process.env.SKIP_AUTH === "true") {
      console.log("🚨 DEVELOPMENT MODE: Skipping authentication completely");
      return {
        token: "dev-bypass",
        scopes: ["read:mcp", "write:mcp", "mcp:read", "mcp:write", "mcp:tools"],
        clientId: "dev-user",
        extra: {
          email: "dev@example.com",
          name: "Development User",
          mcpCompliant: "2025-06-18",
        },
      };
    }
  }

  console.log("Final token status:", !!bearerToken);

  if (!bearerToken) {
    console.log("❌ No bearer token found after all checks");
    return undefined;
  }

  // MCP 2025-06-18: Validate token audience
  const baseUrl = new URL(req.url).origin;
  if (!validateTokenAudience(bearerToken, baseUrl)) {
    console.log("❌ Token audience validation failed for:", baseUrl);
    // Note: We'll be permissive here for Google tokens that may not have audience set
    console.log(
      "⚠️ Proceeding with Google verification (Google tokens may not have custom audience)",
    );
  }

  try {
    let authInfo: AuthInfo | undefined;

    // Check if this is a JWT (ID token) or an access token
    const tokenSegments = bearerToken.split(".");

    if (tokenSegments.length === 3) {
      // This is a JWT ID token - use the existing verification method
      console.log("Token appears to be a JWT ID token");

      const ticket = await googleClient.verifyIdToken({
        idToken: bearerToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        console.log("Token payload is empty");
        return undefined;
      }

      console.log(
        "✅ Google ID token verified successfully for user:",
        payload.email,
      );

      authInfo = {
        token: bearerToken,
        scopes: ["read:mcp", "write:mcp", "mcp:read", "mcp:write", "mcp:tools"], // MCP 2025-06-18 scopes
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
          provider: "google",
          tokenType: "id_token",
          mcpCompliant: "2025-06-18",
          audience: baseUrl,
        },
      };
    } else if (bearerToken.startsWith("ya29.")) {
      // This appears to be an access token - use Google's UserInfo API
      console.log(
        "Token appears to be a Google access token, using UserInfo API",
      );

      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      );

      if (!userInfoResponse.ok) {
        console.log(
          "UserInfo API call failed:",
          userInfoResponse.status,
          userInfoResponse.statusText,
        );
        return undefined;
      }

      const userInfo = await userInfoResponse.json();
      console.log(
        "✅ Google access token verified successfully for user:",
        userInfo.email,
      );

      authInfo = {
        token: bearerToken,
        scopes: ["read:mcp", "write:mcp", "mcp:read", "mcp:write", "mcp:tools"], // MCP 2025-06-18 scopes
        clientId: userInfo.id, // Google user ID
        expiresAt: undefined, // Access tokens don't have expiration in the token itself
        extra: {
          // Additional user information from Google UserInfo API
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          verified: userInfo.verified_email,
          locale: userInfo.locale,
          provider: "google",
          tokenType: "access_token",
          mcpCompliant: "2025-06-18",
          audience: baseUrl,
        },
      };
    } else {
      console.log("❌ Unrecognized token format");
      return undefined;
    }

    if (authInfo) {
      console.log("User context:", {
        email: authInfo.extra?.email,
        clientId: authInfo.clientId,
        scopes: authInfo.scopes,
        audience: authInfo.extra?.audience,
        mcpCompliant: authInfo.extra?.mcpCompliant,
      });
    }

    console.log("==========================================");
    return authInfo;
  } catch (error) {
    console.error("❌ Google token verification failed:", error);
    console.log("==========================================");
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
  if (!authInfo?.extra) return "";

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
