import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";
import { formatUserInfo } from "./auth";

// Zod schema for hello message validation
export const helloSchema = {
  name: z
    .string()
    .optional()
    .default("World")
    .describe("The name of the person to greet"),
};

// Enhanced hello function with authentication support
export function sayHello(
  { name }: { name?: string },
  extra?: { authInfo?: AuthInfo },
) {
  // Validate and get the name
  const validatedName = name || "World";

  // Basic greeting
  const greeting = `👋 Hello, ${validatedName}!`;

  // Add authentication info if available
  const authInfo = extra?.authInfo;
  const userInfo = formatUserInfo(authInfo);

  // Generate message with auth context
  const message = authInfo
    ? `${greeting}${userInfo} This is an authenticated MCP tool!`
    : `${greeting} This is a public MCP tool!`;

  // Return MCP-compatible result format
  return {
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
  };
}

// Tool definition for MCP handler
export const helloTool = {
  name: "say_hello",
  description: "Says hello to someone with authentication info",
  inputSchema: helloSchema,
} as const;
