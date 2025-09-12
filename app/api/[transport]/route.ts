// app/api/[transport]/route.ts - MCP 2025-06-18 OAuth 2.1 Compliant

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler } from "mcp-handler";
import { type NextRequest, NextResponse } from "next/server";
import { verifyGoogleToken } from "@/lib/auth";
import { helloTool, sayHello } from "@/lib/hello";

console.log("🚀 Initializing MCP OAuth 2.1 Server (Specification 2025-06-18)");

// Type definitions for better type safety
interface ToolExtra {
  requestInfo?: {
    headers?: {
      authorization?: string;
    };
  };
}

// Store auth context for current request
let currentAuthInfo: AuthInfo | null = null;

// Create auth-aware tool wrapper
function createAuthenticatedTool(toolFunction: typeof sayHello) {
  return async (args: Record<string, unknown>, extra?: ToolExtra) => {
    // Extract auth info from the request headers if currentAuthInfo is not available
    let authInfo = currentAuthInfo;

    if (!authInfo && extra?.requestInfo?.headers?.authorization) {
      const authHeader = extra.requestInfo.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          // Create a mock request object for verifyGoogleToken
          const mockRequest = {
            headers: new Map([["authorization", authHeader]]),
            url: "http://localhost:3000/api/mcp",
            method: "POST",
          };
          authInfo =
            (await verifyGoogleToken(
              mockRequest as unknown as Request,
              token,
            )) || null;
        } catch (error) {
          console.log("Auth extraction failed:", error);
        }
      }
    }

    // Inject the auth info into the tool call
    const enhancedExtra = {
      ...extra,
      authInfo: authInfo || undefined,
    };
    return toolFunction(args, enhancedExtra);
  };
}

// Create the base MCP handler
const baseHandler = createMcpHandler(
  (server) => {
    console.log("📋 Registering MCP tools with OAuth 2.1 authentication");
    // Register tools with auth context injection
    server.tool(
      helloTool.name,
      helloTool.description,
      helloTool.inputSchema,
      createAuthenticatedTool(sayHello),
    );
  },
  {
    serverInfo: {
      name: "mcp-auth-demo",
      version: "1.0.0",
    },
    capabilities: {
      tools: {
        listChanged: false,
      },
      resources: {
        subscribe: false,
        listChanged: false,
      },
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true,
  },
);

// MCP Authorization Specification compliant wrapper
async function mcpAuthHandler(request: NextRequest) {
  console.log("=== MCP OAUTH 2.1 TOKEN VERIFICATION ===");

  const authHeader = request.headers.get("authorization");
  console.log("Bearer token provided:", !!authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("❌ No valid Authorization header found");
    console.log(
      "📋 Sending 401 with WWW-Authenticate header (MCP Specification compliance)",
    );

    // RFC 9728: WWW-Authenticate header must point to protected resource metadata
    const protectedResourceUrl = `${request.nextUrl.origin}/.well-known/oauth-protected-resource`;

    return new NextResponse(
      JSON.stringify({
        error: "unauthorized",
        message: "Bearer token required",
        details:
          "This MCP server requires OAuth 2.1 authentication. Use the protected resource metadata to discover authorization servers.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          // RFC 9728 Section 5.1: WWW-Authenticate Response
          "WWW-Authenticate": `Bearer realm="MCP Server", resource="${protectedResourceUrl}"`,
        },
      },
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer '
  console.log("Token length:", token.length);
  console.log("Token preview:", `${token.substring(0, 50)}...`);

  try {
    // Verify the Google ID token with enhanced MCP 2025-06-18 validation
    const authInfo = await verifyGoogleToken(request, token);

    if (!authInfo) {
      console.log("❌ Token verification failed - no auth info returned");
      return new NextResponse(
        JSON.stringify({
          error: "invalid_token",
          message: "Token verification failed",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": 'Bearer error="invalid_token"',
          },
        },
      );
    }

    console.log("✅ Google ID token verified successfully");
    console.log("User info:", {
      clientId: authInfo.clientId || "unknown",
      scopes: authInfo.scopes || [],
      email: authInfo.extra?.email || "unknown",
      provider: authInfo.extra?.provider || "unknown",
    });

    // Store auth info for tools to access
    currentAuthInfo = authInfo;

    // Token is valid, proceed to MCP handler
    const response = await baseHandler(request);

    // Clear auth info after request
    currentAuthInfo = null;

    return response;
  } catch (error) {
    console.error("💥 Token verification error:", error);
    return new NextResponse(
      JSON.stringify({
        error: "server_error",
        message: "Token verification failed",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}

console.log("✅ MCP OAuth 2.1 server initialized with compliance features:");
console.log("  - OAuth 2.1 token verification");
console.log("  - Resource parameter validation");
console.log("  - Token audience validation");
console.log("  - WWW-Authenticate headers on 401 (RFC 9728)");
console.log("  - Protected resource metadata endpoint");
console.log("  - Authorization server metadata endpoint");

export { mcpAuthHandler as GET, mcpAuthHandler as POST };
