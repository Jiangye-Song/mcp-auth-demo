import { z } from "zod"

// Shared Zod schema for hello message validation
export const helloSchema = z.object({
  name: z.string().optional().default("World")
})

// Enhanced hello logic that supports both authenticated and non-authenticated users
export function sayHello(params: { name?: string }, userInfo?: { name?: string; email?: string }) {
  // Validate input using the shared schema
  const validatedParams = helloSchema.parse(params)
  
  // Use user info if authenticated, otherwise use provided name
  const displayName = userInfo?.name || validatedParams.name
  const userContext = userInfo ? ` (Authenticated user: ${userInfo.email})` : ''
  
  // Generate hello message
  const message = `👋 Hello, ${displayName}! This is a simple MCP tool saying hi!${userContext}`
  
  // Return standardized result format
  return {
    type: 'text' as const,
    text: message
  }
}

// Tool definition that can be reused
export const helloTool = {
  name: 'say_hello',
  description: 'Says hello to someone with a friendly greeting, personalized for authenticated users',
  schema: helloSchema,
} as const