"use client"

import { useState } from "react"
import { useUser, useAuth, SignInButton, SignOutButton } from '@clerk/nextjs'
import { sayHello as sayHelloAction, listTools } from "@/app/actions/mcp-actions"

export default function Home() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const [name, setName] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tools, setTools] = useState<any>(null)

  const handleSayHello = async () => {
    setLoading(true)
    try {
      const response = await sayHelloAction({ name: name || undefined })
      if (response.success && response.result) {
        setResult(response.result.content[0].text)
      } else if (response.error) {
        setResult(`Error: ${response.error.message}`)
      }
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleListTools = async () => {
    try {
      const response = await listTools()
      setTools(response)
    } catch (error) {
      console.error('Error listing tools:', error)
    }
  }

  const handleTestMcpAuth = async () => {
    setLoading(true)
    try {
      // Get OAuth token for MCP authentication
      const token = await getToken({ template: 'oauth_token' })
      
      if (!token) {
        setResult('Error: Could not get OAuth token')
        return
      }

      // Test authenticated MCP call
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'say_hello',
            arguments: { name: name || undefined }
          },
          id: 1,
        }),
      })

      const data = await response.json()
      if (data.result) {
        setResult(data.result.content[0].text)
      } else if (data.error) {
        setResult(`Error: ${data.error.message}`)
      }
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            🤖 Authenticated MCP Hello Tool
          </h1>
          
          {/* Authentication Status */}
          <div className="mb-8 p-4 rounded-md bg-blue-50 border border-blue-200">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">Authentication Status</h2>
            {user ? (
              <div className="space-y-2">
                <p className="text-blue-800">
                  ✅ Signed in as: <strong>{user.firstName || user.emailAddresses[0]?.emailAddress}</strong>
                </p>
                <SignOutButton>
                  <button className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
                    Sign Out
                  </button>
                </SignOutButton>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-blue-800">❌ Not signed in</p>
                <SignInButton>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Sign In with Google
                  </button>
                </SignInButton>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Test the Hello Tool</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Name (optional - will use authenticated user's name if signed in):
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter a name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="flex space-x-4">
                  <button
                    onClick={handleSayHello}
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Testing..." : "Test Server Action"}
                  </button>
                  
                  {user && (
                    <button
                      onClick={handleTestMcpAuth}
                      disabled={loading}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Testing..." : "Test MCP Auth"}
                    </button>
                  )}
                </div>
                
                {result && (
                  <div className="mt-4 p-4 bg-gray-100 rounded-md">
                    <h3 className="font-medium text-gray-900 mb-2">Result:</h3>
                    <p className="text-gray-700">{result}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">MCP Server Information</h2>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-md">
                  <h3 className="font-medium text-blue-900 mb-2">MCP Endpoint:</h3>
                  <code className="text-sm text-blue-800 bg-blue-100 px-2 py-1 rounded">
                    http://localhost:3000/api/mcp
                  </code>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-md">
                  <h3 className="font-medium text-yellow-900 mb-2">⚠️ Authentication Required</h3>
                  <p className="text-sm text-yellow-800">
                    This MCP server now requires Clerk OAuth authentication. 
                    Direct API calls without valid tokens will be rejected.
                  </p>
                </div>
                
                <button
                  onClick={handleListTools}
                  className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  List Available Tools
                </button>
                
                {tools && (
                  <div className="mt-4 p-4 bg-gray-100 rounded-md">
                    <h3 className="font-medium text-gray-900 mb-2">Available Tools:</h3>
                    <pre className="text-sm text-gray-700 overflow-auto">
                      {JSON.stringify(tools, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">Claude Desktop Configuration</h2>
              <div className="space-y-4">
                <p className="text-gray-700">
                  To use this authenticated MCP server with Claude Desktop, you'll need to set up OAuth authentication.
                  This requires additional configuration beyond the basic setup.
                </p>
                
                <div className="bg-orange-50 p-4 rounded-md">
                  <h3 className="font-medium text-orange-900 mb-2">OAuth Authentication Setup</h3>
                  <p className="text-sm text-orange-800 mb-2">
                    For OAuth-protected MCP servers, Claude Desktop needs to authenticate with your Clerk application.
                    This typically involves setting up OAuth applications in Clerk and configuring the OAuth flow.
                  </p>
                  <p className="text-sm text-orange-800">
                    See the Clerk MCP documentation for detailed setup instructions.
                  </p>
                </div>
                
                <div className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-auto">
                  <pre className="text-sm">
{`{
  "mcpServers": {
    "hello-mcp-auth": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3000/api/mcp"
      ],
      "oauth": {
        "authorization_server": "http://localhost:3000/.well-known/oauth-authorization-server",
        "protected_resource": "http://localhost:3000/.well-known/oauth-protected-resource/mcp"
      }
    }
  }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
