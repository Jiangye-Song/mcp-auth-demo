// app/api/[transport]/route.ts
import { verifyClerkToken } from '@clerk/mcp-tools/next'
import { createMcpHandler, experimental_withMcpAuth as withMcpAuth } from '@vercel/mcp-adapter'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { sayHello, helloTool } from "@/lib/hello";

const clerk = await clerkClient()

const handler = createMcpHandler((server) => {
  server.tool(
    'say_hello',
    'Says hello to an authenticated user with personalized greeting',
    {},
    async (_, { authInfo }) => {
      const userId = authInfo!.extra!.userId! as string
      const userData = await clerk.users.getUser(userId)
      
      // Use the authenticated user's first name or email
      const name = userData.firstName || userData.emailAddresses[0]?.emailAddress || 'User'
      const result = sayHello({ name })
      
      return {
        content: [{ type: 'text', text: `${result.text} (Authenticated as: ${name})` }],
      }
    },
  )
})

const authHandler = withMcpAuth(
  handler,
  async (_, token) => {
    const clerkAuth = await auth({ acceptsToken: 'oauth_token' })
    return verifyClerkToken(clerkAuth, token)
  },
  {
    required: true,
    resourceMetadataPath: '/.well-known/oauth-protected-resource/mcp',
  },
)

export { authHandler as GET, authHandler as POST }