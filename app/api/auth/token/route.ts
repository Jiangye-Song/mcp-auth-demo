import { createHash } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import type { AuthCodeData, GoogleTokens } from "../../../../lib/auth-types";
import {
  buildTokenResponse,
  CORS_CONFIGS,
  createOAuth21ErrorResponse,
  createOPTIONSResponse,
  exchangeCodeForGoogleTokens,
  normalizeRedirectUri,
  OAuthLogger,
  validateTokenParams,
} from "../../../../lib/oauth-utils";
import { resolveApiDomain } from "../../../../lib/url-resolver";
import "../../../../lib/auth-types"; // Import shared types

/**
 * OAuth 2.1 Token Endpoint for VS Code MCP Authentication
 * Implements authorization code exchange with PKCE verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);

    // Extract token request parameters
    const tokenParams = {
      grant_type: params.get("grant_type"),
      code: params.get("code"),
      redirect_uri: params.get("redirect_uri"),
      client_id: params.get("client_id"),
      code_verifier: params.get("code_verifier"),
    };

    // Log request
    OAuthLogger.tokenRequest(tokenParams);

    // Validate parameters
    const validation = validateTokenParams(tokenParams);
    if (!validation.isValid) {
      OAuthLogger.error(
        "Token validation",
        validation.errorDescription || "Unknown validation error",
      );
      return createOAuth21ErrorResponse(
        validation.error || "invalid_request",
        validation.errorDescription || "Invalid request parameters",
      );
    }

    const {
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    } = tokenParams;

    // Retrieve stored authorization code data
    const authCodes = globalThis.authCodes || new Map();
    const authData = authCodes.get(code) as AuthCodeData | undefined;

    if (!authData) {
      OAuthLogger.error(
        "Token validation",
        "Invalid or expired authorization code",
      );
      return createOAuth21ErrorResponse(
        "invalid_grant",
        "Invalid or expired authorization code",
      );
    }

    // Check if code has expired (10 minutes)
    if (Date.now() > authData.expiresAt) {
      OAuthLogger.error("Token validation", "Authorization code expired");
      authCodes.delete(code);
      return createOAuth21ErrorResponse(
        "invalid_grant",
        "Authorization code expired",
      );
    }

    // Validate redirect URI matches (normalize localhost vs 127.0.0.1 for OAuth 2.1 compatibility)
    const normalizedStoredUri = normalizeRedirectUri(authData.redirectUri);
    const normalizedRequestUri = normalizeRedirectUri(redirectUri || "");

    if (normalizedStoredUri !== normalizedRequestUri) {
      OAuthLogger.error("Token validation", "Redirect URI mismatch");
      console.log("Stored (normalized):", normalizedStoredUri);
      console.log("Request (normalized):", normalizedRequestUri);
      return createOAuth21ErrorResponse(
        "invalid_grant",
        "Redirect URI does not match",
      );
    }

    // Validate client ID if provided
    if (clientId && authData.clientId !== clientId) {
      OAuthLogger.error("Token validation", "Client ID mismatch");
      return createOAuth21ErrorResponse(
        "invalid_client",
        "Client ID does not match",
      );
    }

    // PKCE verification if code challenge was provided
    if (authData.codeChallenge) {
      if (!codeVerifier) {
        OAuthLogger.error("PKCE validation", "Missing code verifier");
        return createOAuth21ErrorResponse(
          "invalid_request",
          "Code verifier required for PKCE",
        );
      }

      // Verify PKCE S256
      const computedChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      if (computedChallenge !== authData.codeChallenge) {
        OAuthLogger.error("PKCE validation", "PKCE verification failed");
        return createOAuth21ErrorResponse(
          "invalid_grant",
          "PKCE verification failed",
        );
      }

      console.log("✅ PKCE verification successful");
    }

    // Check if we have stored Google tokens for this authorization code
    if (authData.googleTokens) {
      console.log("✅ Using stored Google tokens for authorization code");
      const googleTokens = authData.googleTokens as GoogleTokens;

      // Clean up used authorization code
      authCodes.delete(code);

      // Build token response using utility function
      const tokenResponseData = buildTokenResponse(
        googleTokens,
        authData.scope,
      );

      OAuthLogger.tokenSuccess(tokenResponseData);
      console.log("(stored tokens)");

      return NextResponse.json(tokenResponseData);
    }

    // Fallback: Exchange authorization code for Google tokens (shouldn't happen with new flow)
    console.log(
      "⚠️ No stored tokens - attempting direct Google exchange (fallback)",
    );
    console.log("🔄 Exchanging authorization code with Google...");

    const exchangeResult = await exchangeCodeForGoogleTokens(
      code || "",
      `${resolveApiDomain()}/api/auth/callback/google`,
    );

    if (!exchangeResult.success || !exchangeResult.tokens) {
      OAuthLogger.error(
        "Google token exchange",
        exchangeResult.error || "Unknown error",
      );
      return createOAuth21ErrorResponse(
        "server_error",
        "Failed to exchange authorization code with Google",
        500,
        { details: exchangeResult.error },
      );
    }

    console.log("✅ Google token exchange successful");
    console.log("Received tokens:", Object.keys(exchangeResult.tokens));

    // Clean up used authorization code
    authCodes.delete(code);

    // Build token response using utility function
    const tokenResponseData = buildTokenResponse(
      exchangeResult.tokens,
      authData.scope,
    );

    OAuthLogger.tokenSuccess(tokenResponseData);

    return NextResponse.json(tokenResponseData);
  } catch (error) {
    OAuthLogger.error(
      "Token endpoint",
      error instanceof Error ? error.message : String(error),
    );
    return createOAuth21ErrorResponse(
      "server_error",
      "Internal server error during token exchange",
      500,
      { details: error instanceof Error ? error.message : String(error) },
    );
  }
}

// Handle preflight OPTIONS requests
export async function OPTIONS(_request: NextRequest) {
  return createOPTIONSResponse(CORS_CONFIGS.oauth);
}
