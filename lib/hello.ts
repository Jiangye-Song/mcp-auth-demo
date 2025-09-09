import { z } from "zod"

// Shared Zod schema for hello message validation
export const helloSchema = z.string().optional().default("World")

// Shared hello logic used by both MCP handler and server actions
export function sayHello(name?: string) {
  // Validate input using the shared schema
  const validatedName = helloSchema.parse(name)

  // Generate hello message
  const message = `👋 Hello, ${validatedName}! This is a simple MCP tool saying hi!`

  // Return standardized result format
  return {
    type: 'text' as const,
    text: message
  }
}

// Tool definition that can be reused
export const helloTool = {
  name: 'say_hello',
  description: 'Says hello to someone with a friendly greeting',
  schema: {
    name: helloSchema,
  }
} as const