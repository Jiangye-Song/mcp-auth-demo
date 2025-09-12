"use client";

import { useState } from "react";
import {
  listTools,
  sayHello as sayHelloAction,
} from "@/app/actions/mcp-actions";
import { getMcpEndpointUrl, resolveApiDomain } from "@/lib/url-resolver";

export default function Home() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<Record<string, unknown> | null>(null);
  const [token, setToken] = useState("");

  const handleSayHello = async () => {
    setLoading(true);
    try {
      const response = await sayHelloAction(name || undefined);
      if (response.success && response.result) {
        setResult(response.result.content[0].text);
      } else if (response.error) {
        setResult(`Error: ${response.error.message}`);
      }
    } catch (error) {
      setResult(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleListTools = async () => {
    try {
      const response = await listTools();
      setTools(response);
    } catch (error) {
      console.error("Error listing tools:", error);
    }
  };

  const handleTestMcpAuth = async () => {
    setLoading(true);
    try {
      if (!token) {
        setResult("Error: Please enter a Google ID token");
        return;
      }

      // Test authenticated MCP call
      const response = await fetch(getMcpEndpointUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "say_hello",
            arguments: { name: name || undefined },
          },
          id: 1,
        }),
      });

      const data = await response.json();
      if (data.result) {
        setResult(data.result.content[0].text);
      } else if (data.error) {
        setResult(`Error: ${data.error.message}`);
      }
    } catch (error) {
      setResult(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTestUnauthenticated = async () => {
    setLoading(true);
    try {
      // Test unauthenticated MCP call - should return 401
      const response = await fetch(getMcpEndpointUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "say_hello",
            arguments: { name: name || undefined },
          },
          id: 1,
        }),
      });

      if (response.status === 401) {
        const errorData = await response.json();
        setResult(
          `✅ Authentication required (expected): ${errorData.error?.message || "Unauthorized"}`,
        );
      } else {
        const data = await response.json();
        setResult(`❌ Unexpected response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      setResult(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            🤖 Google OAuth MCP Hello Tool
          </h1>

          {/* Authentication Status */}
          <div className="mb-8 p-4 rounded-md bg-blue-50 border border-blue-200">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              Authentication Testing
            </h2>
            <p className="text-blue-800 mb-4">
              This MCP server now requires Google OAuth ID tokens for
              authentication.
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="token"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Google ID Token (for testing authenticated requests):
                </label>
                <textarea
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your Google ID token here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get this from Google OAuth flow or use a test tool like{" "}
                  <a
                    href="https://developers.google.com/oauthplayground"
                    className="text-blue-600 hover:underline"
                  >
                    OAuth 2.0 Playground
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Test the Hello Tool
              </h2>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Name (optional):
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={handleSayHello}
                    disabled={loading}
                    className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Testing..." : "Test Server Action"}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestUnauthenticated}
                    disabled={loading}
                    className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Testing..." : "Test Unauthenticated"}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestMcpAuth}
                    disabled={loading || !token}
                    className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Testing..." : "Test Authenticated"}
                  </button>
                </div>

                {result && (
                  <div className="mt-4 p-4 bg-gray-100 rounded-md">
                    <h3 className="font-medium text-gray-900 mb-2">Result:</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {result}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">
                MCP Server Information
              </h2>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-md">
                  <h3 className="font-medium text-blue-900 mb-2">
                    MCP Endpoint:
                  </h3>
                  <code className="text-sm text-blue-800 bg-blue-100 px-2 py-1 rounded">
                    {getMcpEndpointUrl()}
                  </code>
                </div>

                <div className="bg-green-50 p-4 rounded-md">
                  <h3 className="font-medium text-green-900 mb-2">
                    OAuth Metadata Endpoint:
                  </h3>
                  <code className="text-sm text-green-800 bg-green-100 px-2 py-1 rounded">
                    {resolveApiDomain()}/.well-known/oauth-protected-resource
                  </code>
                </div>

                <div className="bg-yellow-50 p-4 rounded-md">
                  <h3 className="font-medium text-yellow-900 mb-2">
                    ⚠️ Google OAuth Required
                  </h3>
                  <p className="text-sm text-yellow-800">
                    This MCP server requires Google ID tokens for
                    authentication. Unauthenticated requests will receive 401
                    responses.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleListTools}
                  className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  List Available Tools
                </button>

                {tools && (
                  <div className="mt-4 p-4 bg-gray-100 rounded-md">
                    <h3 className="font-medium text-gray-900 mb-2">
                      Available Tools:
                    </h3>
                    <pre className="text-sm text-gray-700 overflow-auto">
                      {JSON.stringify(tools, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">
                Claude Desktop Configuration
              </h2>
              <div className="space-y-4">
                <p className="text-gray-700">
                  To use this Google OAuth protected MCP server with Claude
                  Desktop:
                </p>

                <div className="bg-orange-50 p-4 rounded-md">
                  <h3 className="font-medium text-orange-900 mb-2">
                    OAuth Configuration
                  </h3>
                  <p className="text-sm text-orange-800 mb-2">
                    Claude Desktop needs to authenticate with Google OAuth 2.0
                    to access this MCP server. The server will validate Google
                    ID tokens.
                  </p>
                  <p className="text-sm text-orange-800">
                    Authorization Server:{" "}
                    <code>https://accounts.google.com</code>
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
        "${getMcpEndpointUrl()}"
      ],
      "oauth": {
        "authorization_server": "https://accounts.google.com",
        "protected_resource": "${resolveApiDomain()}/.well-known/oauth-protected-resource"
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
  );
}
