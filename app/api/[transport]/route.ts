// app/api/[transport]/route.ts - MCP 2025-06-18 OAuth 2.1 Compliant
import { createMcpHandler } from "mcp-handler";
import { sayHello, helloTool } from "@/lib/hello";
import { verifyGoogleToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

console.log('🚀 Initializing MCP OAuth 2.1 Server (Specification 2025-06-18)');

// Create the base MCP handler
const baseHandler = createMcpHandler(
  (server) => {
    console.log('📋 Registering MCP tools with OAuth 2.1 authentication');
    server.tool(helloTool.name, helloTool.description, helloTool.inputSchema, sayHello);
  },
  {
    serverInfo: {
      name: "mcp-auth-demo",
      version: "1.0.0"
    },
    capabilities: {
      tools: {
        listChanged: false
      },
      resources: {
        subscribe: false,
        listChanged: false
      }
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true
  }
);

// MCP Authorization Specification compliant wrapper
async function mcpAuthHandler(request: NextRequest) {
  console.log('=== MCP OAUTH 2.1 TOKEN VERIFICATION ===');

  const authHeader = request.headers.get('authorization');
  console.log('Bearer token provided:', !!authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No valid Authorization header found');
    console.log('📋 Sending 401 with WWW-Authenticate header (MCP Specification compliance)');

    // RFC 9728: WWW-Authenticate header must point to protected resource metadata
    const protectedResourceUrl = `${request.nextUrl.origin}/.well-known/oauth-protected-resource`;

    return new NextResponse(
      JSON.stringify({
        error: "unauthorized",
        message: "Bearer token required",
        details: "This MCP server requires OAuth 2.1 authentication. Use the protected resource metadata to discover authorization servers."
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          // RFC 9728 Section 5.1: WWW-Authenticate Response
          'WWW-Authenticate': `Bearer realm="MCP Server", resource="${protectedResourceUrl}"`
        }
      }
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer '
  console.log('Token length:', token.length);
  console.log('Token preview:', `${token.substring(0, 50)}...`);

  try {
    // Verify the Google ID token with enhanced MCP 2025-06-18 validation
    const authInfo = await verifyGoogleToken(request, token);

    if (!authInfo) {
      console.log('❌ Token verification failed - no auth info returned');
      return new NextResponse(
        JSON.stringify({
          error: "invalid_token",
          message: "Token verification failed"
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer error="invalid_token"'
          }
        }
      );
    }

    console.log('✅ Google ID token verified successfully');
    console.log('User info:', {
      clientId: authInfo.clientId || 'unknown',
      scopes: authInfo.scopes || [],
      email: authInfo.extra?.email || 'unknown',
      provider: authInfo.extra?.provider || 'unknown'
    });

    // Token is valid, proceed to MCP handler
    return baseHandler(request);

  } catch (error) {
    console.error('💥 Token verification error:', error);
    return new NextResponse(
      JSON.stringify({
        error: "server_error",
        message: "Token verification failed"
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

console.log('✅ MCP OAuth 2.1 server initialized with compliance features:');
console.log('  - OAuth 2.1 token verification');
console.log('  - Resource parameter validation');
console.log('  - Token audience validation');
console.log('  - WWW-Authenticate headers on 401 (RFC 9728)');
console.log('  - Protected resource metadata endpoint');
console.log('  - Authorization server metadata endpoint');

export { mcpAuthHandler as GET, mcpAuthHandler as POST };