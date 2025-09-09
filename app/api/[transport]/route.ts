// app/api/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { sayHello, helloTool } from "@/lib/hello";
import { verifyGoogleToken } from "@/lib/auth";

// Create the base MCP handler
const handler = createMcpHandler(
  (server) => {
    server.tool(helloTool.name, helloTool.description, helloTool.inputSchema, sayHello);
  },
  {
    serverInfo: {
      name: "mcp-auth-demo",
      version: "1.0.0",
    },
    // Add auth capability announcement
    capabilities: {
      auth: {
        type: "bearer",
        required: true,
      },
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true,
  }
);

// Wrap with Google OAuth authentication
const authHandler = withMcpAuth(handler, verifyGoogleToken, {
  required: true, // Make authentication mandatory
  requiredScopes: ['read:mcp'], // Require specific scopes
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };