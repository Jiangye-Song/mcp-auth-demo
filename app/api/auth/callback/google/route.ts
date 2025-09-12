import { type NextRequest, NextResponse } from "next/server";
import {
  createOAuth21ErrorRedirect,
  createOAuth21ErrorResponse,
} from "../../../../../lib/oauth-utils";
import { resolveApiDomain } from "../../../../../lib/url-resolver";
import "../../../../../lib/auth-types"; // Import shared types

export async function GET(request: NextRequest) {
  console.log("🔥 OAUTH CALLBACK HIT 🔥 - ", new Date().toISOString());

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // Get OAuth response parameters
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const stateParam = searchParams.get("state");

  console.log("OAuth callback received:");
  console.log("Code:", code ? "present" : "missing");
  console.log("Error:", error);
  console.log("State:", stateParam);

  if (error) {
    console.error("OAuth error:", error);
    return createOAuth21ErrorResponse(error, "OAuth authorization failed");
  }

  if (!code) {
    console.error("No authorization code received");
    return createOAuth21ErrorResponse(
      "invalid_request",
      "No authorization code received",
    );
  }

  try {
    // Parse the extended state to get client's original redirect URI
    let originalRedirectUri = ""; // Will be set from state or error
    let originalState = "";
    let clientType = "unknown";

    if (stateParam) {
      try {
        console.log("Raw state parameter:", stateParam);
        console.log("Attempting to decode base64url state...");

        // Decode base64url-encoded state
        const decodedState = Buffer.from(stateParam, "base64url").toString(
          "utf-8",
        );
        console.log("Decoded state:", decodedState);

        const parsedState = JSON.parse(decodedState);
        console.log("Parsed state object:", parsedState);

        originalRedirectUri = parsedState.originalRedirectUri || "";
        originalState = parsedState.originalState || "";

        // Handle VS Code MCP format that uses 'resource' field instead of 'originalRedirectUri'
        // The 'resource' field contains the MCP endpoint, but we need the actual redirect URI
        // For now, we'll log this case and return a helpful error
        if (!originalRedirectUri && parsedState.resource) {
          console.error(
            "❌ VS Code MCP state format detected with 'resource' field",
          );
          console.error("Resource:", parsedState.resource);
          console.error(
            "This suggests the OAuth authorization request is missing the original redirect URI",
          );
          console.error(
            "VS Code should provide the redirect URI in the state parameter",
          );
          return createOAuth21ErrorResponse(
            "invalid_state",
            "VS Code MCP format detected but missing original redirect URI. The authorization flow needs to preserve the VS Code callback URI in the state parameter.",
            400,
          );
        }

        // Validate that we got a redirect URI from the state
        if (!originalRedirectUri) {
          console.error("❌ No originalRedirectUri found in state parameter");
          console.error("Parsed state:", parsedState);
          return createOAuth21ErrorResponse(
            "invalid_state",
            "No original redirect URI found in state parameter",
            400,
          );
        } // Detect client type based on redirect URI pattern with strict OAuth 2.1 validation
        if (originalRedirectUri.includes("oauth/callback")) {
          // MCP Remote (mcp-remote tool) and Claude Desktop both use /oauth/callback pattern
          clientType = "mcp-remote";
        } else if (originalRedirectUri.includes("vscode.dev/redirect")) {
          clientType = "vscode-web";
        } else if (
          originalRedirectUri.startsWith("http://127.0.0.1:") ||
          originalRedirectUri.startsWith("http://localhost:")
        ) {
          // Ensure VS Code local follows proper port patterns for OAuth 2.1 compliance
          const vsCodePattern = /^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/;
          if (vsCodePattern.test(originalRedirectUri)) {
            clientType = "vscode-local";
          } else {
            clientType = "unsupported";
          }
        } else {
          // OAuth 2.1: No generic fallback allowed
          clientType = "unsupported";
        }

        console.log("Detected client type:", clientType);

        // Reject unsupported clients immediately (OAuth 2.1 compliance)
        if (clientType === "unsupported") {
          console.error(
            "❌ OAuth 2.1 Compliance: Unsupported client redirect URI:",
            originalRedirectUri,
          );
          return createOAuth21ErrorRedirect(
            originalRedirectUri,
            "invalid_client",
            "Client redirect URI not supported for OAuth 2.1 compliance",
            originalState,
          );
        }
      } catch (e) {
        console.log(
          "Could not decode/parse state, trying direct JSON parse...",
        );
        try {
          const parsedState = JSON.parse(stateParam);
          originalRedirectUri =
            parsedState.originalRedirectUri || parsedState.resource || "";
          originalState = parsedState.originalState || "";

          // Apply the same VS Code MCP logic for legacy format
          if (!originalRedirectUri || parsedState.resource) {
            console.log("Checking for VS Code MCP pattern in legacy format...");
            console.log("Resource field:", parsedState.resource);

            if (parsedState.resource && !parsedState.originalRedirectUri) {
              if (
                parsedState.resource.includes("localhost") ||
                parsedState.resource.includes("127.0.0.1")
              ) {
                console.log("Detected VS Code local MCP flow (legacy format)");
                originalRedirectUri =
                  "vscode://ms-vscode.vscode-mcp/oauth-callback";
                clientType = "vscode-local";
              } else {
                console.log("Detected VS Code remote MCP flow (legacy format)");
                originalRedirectUri =
                  "vscode://ms-vscode.vscode-mcp/oauth-callback";
                clientType = "vscode-mcp";
              }
            }
          }

          if (!originalRedirectUri) {
            console.error(
              "❌ No originalRedirectUri found in legacy format state",
            );
            return createOAuth21ErrorResponse(
              "invalid_state",
              "No original redirect URI found in state parameter",
              400,
            );
          }

          if (clientType === "unknown") {
            clientType = "legacy-format";
          }
        } catch (_e2) {
          console.log("Parse error:", e);
          console.error("❌ Could not parse state parameter in any format");
          return createOAuth21ErrorResponse(
            "invalid_state",
            "Could not parse state parameter",
            400,
          );
        }
      }
    } else {
      // No state parameter provided - this is required for OAuth 2.1
      console.error("❌ OAuth 2.1 Compliance: No state parameter provided");
      return createOAuth21ErrorResponse(
        "invalid_request",
        "State parameter is required for OAuth 2.1 compliance",
        400,
      );
    }

    console.log("Client details:", {
      type: clientType,
      originalRedirectUri,
      originalState,
    });

    // Exchange authorization code for tokens
    // Use the same redirect URI that was used in the authorization request
    const baseUrl = resolveApiDomain();
    const redirectUriForTokenExchange = `${baseUrl}/api/auth/callback/google`;

    console.log(
      "Using redirect URI for token exchange:",
      redirectUriForTokenExchange,
    );

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        code: code,
        grant_type: "authorization_code",
        redirect_uri: redirectUriForTokenExchange,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return createOAuth21ErrorResponse(
        "token_exchange_failed",
        "Failed to exchange authorization code for tokens",
        500,
        { details: errorData },
      );
    }

    const tokens = await tokenResponse.json();
    console.log("=== TOKEN EXCHANGE RESPONSE ===");
    console.log("Token exchange successful, received:", Object.keys(tokens));
    console.log("ID token present:", !!tokens.id_token);
    console.log("Access token present:", !!tokens.access_token);
    console.log("Refresh token present:", !!tokens.refresh_token);
    console.log("ID token length:", tokens.id_token?.length || 0);
    console.log("Access token length:", tokens.access_token?.length || 0);
    console.log(
      "ID token preview:",
      tokens.id_token ? `${tokens.id_token.substring(0, 50)}...` : "none",
    );
    console.log(
      "Access token preview:",
      tokens.access_token
        ? `${tokens.access_token.substring(0, 50)}...`
        : "none",
    );
    console.log(
      "ID token segments:",
      tokens.id_token ? tokens.id_token.split(".").length : 0,
    );
    console.log("===============================");

    // Store Google tokens with our authorization code for later exchange
    let authCode = "";
    if (stateParam) {
      try {
        const decodedState = Buffer.from(stateParam, "base64url").toString(
          "utf-8",
        );
        const parsedState = JSON.parse(decodedState);
        authCode = parsedState.authCode || "";

        // Update our stored authorization code with the Google tokens
        if (authCode && globalThis.authCodes) {
          const authData = globalThis.authCodes.get(authCode);
          if (authData) {
            authData.googleTokens = tokens;
            globalThis.authCodes.set(authCode, authData);
            console.log(
              "✅ Stored Google tokens with authorization code:",
              authCode,
            );
          }
        }
      } catch (_e) {
        console.log("Could not extract/update auth code from state");
      }
    }

    // Build the redirect URL back to the client with the appropriate token
    let finalRedirectUrl: string;

    console.log("=== REDIRECT URL CONSTRUCTION ===");
    console.log("Client type:", clientType);
    console.log("Original redirect URI:", originalRedirectUri);
    console.log("Original state:", originalState);

    if (tokens.id_token) {
      if (clientType === "mcp-remote") {
        // MCP Remote expects authorization code flow (like VS Code)
        const clientRedirectUrl = new URL(originalRedirectUri);

        // Return our authorization code (not Google's tokens directly)
        if (authCode) {
          clientRedirectUrl.searchParams.set("code", authCode);
        } else {
          // Fallback: use Google's code directly
          clientRedirectUrl.searchParams.set("code", code);
        }

        if (originalState) {
          clientRedirectUrl.searchParams.set("state", originalState);
        }

        finalRedirectUrl = clientRedirectUrl.toString();
        console.log("Using authorization code flow for MCP Remote");
        console.log(
          "Returning authorization code for MCP Remote to exchange:",
          authCode || code,
        );
      } else if (
        clientType === "vscode-web" &&
        originalRedirectUri === "https://vscode.dev/redirect"
      ) {
        // VS Code web redirect - use vscode.dev redirect with parameters
        console.log("Processing VS Code web redirect");

        // Use vscode.dev redirect URL with query parameters (VS Code expects this format)
        const vsCodeRedirectUrl = new URL("https://vscode.dev/redirect");

        // Add VS Code callback parameters
        vsCodeRedirectUrl.searchParams.set("vscode-scheme", "vscode");
        vsCodeRedirectUrl.searchParams.set(
          "vscode-authority",
          "ms-vscode.vscode-mcp",
        );
        vsCodeRedirectUrl.searchParams.set("vscode-path", "/oauth-callback");
        vsCodeRedirectUrl.searchParams.set("access_token", tokens.id_token);
        vsCodeRedirectUrl.searchParams.set("token_type", "Bearer");
        vsCodeRedirectUrl.searchParams.set(
          "expires_in",
          tokens.expires_in?.toString() || "3600",
        );

        if (originalState) {
          vsCodeRedirectUrl.searchParams.set("state", originalState);
        }

        finalRedirectUrl = vsCodeRedirectUrl.toString();
        console.log("Using VS Code web redirect with protocol parameters");
      } else if (
        clientType === "vscode-local" &&
        (originalRedirectUri.startsWith("http://127.0.0.1:") ||
          originalRedirectUri.startsWith("http://localhost:"))
      ) {
        // VS Code local server - OAuth 2.1 compliant authorization code flow
        const baseUrl = originalRedirectUri.split("#")[0].split("?")[0];
        const vsCodeUrl = new URL(baseUrl);

        // Extract our stored authorization code from parsed state
        let authCode = "";
        if (stateParam) {
          try {
            const decodedState = Buffer.from(stateParam, "base64url").toString(
              "utf-8",
            );
            const parsedState = JSON.parse(decodedState);
            authCode = parsedState.authCode || "";
            console.log("Retrieved stored auth code:", authCode);
          } catch (_e) {
            console.log("Could not extract auth code from state");
          }
        }

        // Return authorization code (OAuth 2.1 compliant - no hash fragments)
        if (authCode) {
          vsCodeUrl.searchParams.set("code", authCode);
        } else {
          // Fallback: use Google's code directly
          vsCodeUrl.searchParams.set("code", code);
        }

        if (originalState && originalState.trim() !== "") {
          vsCodeUrl.searchParams.set("state", originalState);
        }

        finalRedirectUrl = vsCodeUrl.toString();
        console.log(
          "✅ OAuth 2.1 Compliant: Using authorization code flow for VS Code local server",
        );
        console.log("VS Code redirect URI preserved:", baseUrl);
        console.log(
          "Returning authorization code for VS Code to exchange:",
          authCode || code,
        );
      } else {
        // OAuth 2.1 Compliance: No hash fragment fallback allowed
        console.error(
          "❌ OAuth 2.1 Violation: Unsupported client type for authentication:",
          clientType,
        );
        console.error("Redirect URI:", originalRedirectUri);

        return createOAuth21ErrorRedirect(
          originalRedirectUri,
          "unsupported_response_type",
          "OAuth 2.1 only supports authorization code flow with query parameters",
          originalState,
        );
      }

      console.log(
        "Token is JWT format:",
        tokens.id_token.split(".").length === 3,
      );
      console.log("State being returned:", originalState);
    } else {
      console.error("No ID token received from Google");
      console.log("Available tokens:", Object.keys(tokens));

      const baseUrl = originalRedirectUri.split("#")[0].split("?")[0];
      const errorParams = new URLSearchParams({
        error: "no_id_token",
        error_description: "No ID token received from Google",
      });
      finalRedirectUrl = `${baseUrl}#${errorParams.toString()}`;
    }

    console.log("==================================");

    console.log(
      `✅ OAuth 2.1 Compliant: Final ${clientType} redirect URL (token masked):`,
      finalRedirectUrl
        .replace(tokens.id_token || "", "[ID_TOKEN_MASKED]")
        .replace(tokens.access_token || "", "[ACCESS_TOKEN_MASKED]"),
    );

    // Redirect back to the client with the appropriate tokens
    return NextResponse.redirect(finalRedirectUrl);
  } catch (err) {
    console.error("Error in OAuth callback:", err);

    // Return OAuth 2.1 compliant error information
    return createOAuth21ErrorResponse(
      "server_error",
      "Error processing OAuth 2.1 callback",
      500,
      {
        details: err instanceof Error ? err.message : String(err),
      },
    );
  }
}
export async function POST(request: NextRequest) {
  const body = await request.text();

  console.log("OAuth callback POST received:");
  console.log("URL:", request.url);
  console.log("Body:", body);
  console.log("Headers:", Object.fromEntries(request.headers.entries()));

  return NextResponse.json({
    message: "OAuth callback POST received",
    url: request.url,
    body,
    headers: Object.fromEntries(request.headers.entries()),
  });
}
