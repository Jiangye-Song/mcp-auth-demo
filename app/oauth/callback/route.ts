import { type NextRequest, NextResponse } from "next/server";

/**
 * Claude Desktop OAuth callback endpoint
 * This handles the OAuth callback for Claude Desktop which expects /oauth/callback
 */
export async function GET(request: NextRequest) {
  console.log("🎯 OAUTH CALLBACK HIT 🎯 - ", new Date().toISOString());

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
  console.log("State type:", typeof stateParam);
  console.log("State length:", stateParam?.length || 0);
  console.log("Full URL:", request.url);

  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.json(
      { error, error_description: "OAuth authorization failed" },
      { status: 400 },
    );
  }

  if (!code) {
    console.error("No authorization code received");
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "No authorization code received",
      },
      { status: 400 },
    );
  }

  // Check if this is a manual test vs mcp-remote
  // Manual tests will have specific markers in their state
  // MCP-remote will either have our wrapped state format or a simple string
  let isManualTest = false;
  let mcpOriginalState = stateParam;
  let originalRedirectUri = "";
  let codeVerifier = "";

  try {
    if (stateParam) {
      const stateData = JSON.parse(stateParam);

      // Check if this is our wrapped mcp-remote state format
      if (stateData.mcpState !== undefined) {
        // This is mcp-remote with our wrapped state
        isManualTest = false;
        mcpOriginalState = stateData.mcpState;
        originalRedirectUri = stateData.originalRedirectUri || "";
        console.log(
          "Detected wrapped mcp-remote state, originalRedirectUri:",
          originalRedirectUri,
        );
      } else if (
        stateData.originalState !== undefined ||
        stateParam.includes("manual-test") ||
        stateParam.includes("simple-test")
      ) {
        // This is a manual test
        isManualTest = true;
        codeVerifier = stateData.codeVerifier || "";
        console.log("Detected manual test state");
      } else {
        // Unknown JSON format, treat as manual test to be safe
        isManualTest = true;
        console.log("Unknown JSON state format, treating as manual test");
      }
    }
  } catch (_e) {
    // State is not JSON, could be mcp-remote with simple string state
    isManualTest = false;
    console.log(
      "State is not JSON, treating as mcp-remote (but no originalRedirectUri available)",
    );
  }

  if (isManualTest) {
    console.log("Manual test detected, performing token exchange");

    // Perform token exchange for manual tests
    const tokenRequestBody = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      code: code,
      grant_type: "authorization_code",
      redirect_uri: `${url.origin}/oauth/callback`,
    });

    if (codeVerifier) {
      tokenRequestBody.append("code_verifier", codeVerifier);
      console.log("Added code_verifier for PKCE flow");
    }

    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenRequestBody,
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("Token exchange failed:", errorData);
        return NextResponse.json(
          {
            error: "token_exchange_failed",
            error_description:
              "Failed to exchange authorization code for tokens",
            details: errorData,
          },
          { status: 500 },
        );
      }

      const tokens = await tokenResponse.json();
      console.log("✅ Manual test token exchange successful");

      return NextResponse.json({
        access_token: tokens.access_token,
        id_token: tokens.id_token,
        refresh_token: tokens.refresh_token,
        token_type: "Bearer",
        expires_in: tokens.expires_in,
        scope: "openid email profile",
        state: stateParam,
      });
    } catch (err) {
      console.error("Token exchange error:", err);
      return NextResponse.json(
        {
          error: "token_exchange_failed",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  } else {
    console.log("MCP-Remote detected, redirecting to localhost callback");

    // For mcp-remote, we need to redirect back to their localhost callback
    // The authorization code will be consumed by mcp-remote, which will then
    // use our custom token endpoint for the token exchange

    if (originalRedirectUri?.includes("localhost")) {
      try {
        const forwardUrl = new URL(originalRedirectUri);
        forwardUrl.searchParams.set("code", code);
        forwardUrl.searchParams.set("state", mcpOriginalState || "");

        console.log(
          "Redirecting to mcp-remote localhost:",
          forwardUrl.toString(),
        );

        // Redirect to mcp-remote's localhost callback
        return NextResponse.redirect(forwardUrl.toString());
      } catch (err) {
        console.error("Failed to redirect to mcp-remote localhost:", err);
      }
    }

    // Fallback: return the code as JSON if we can't redirect
    console.log("Could not redirect to localhost, returning code as JSON");
    return NextResponse.json(
      {
        code: code,
        state: mcpOriginalState,
        status: "authorization_successful",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  // Handle POST requests for Claude Desktop if needed
  return GET(request);
}

export async function OPTIONS(_request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
