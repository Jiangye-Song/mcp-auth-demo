'use client';

import { useState } from 'react';

export default function DebugOAuthPage() {
    const [authUrl, setAuthUrl] = useState('');
    const [testResult, setTestResult] = useState('');

    // Helper function to generate cryptographically secure random string
    const generateCodeVerifier = () => {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, Array.from(array)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    };

    // Helper function to generate code challenge from verifier
    const generateCodeChallenge = async (verifier: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const generateAuthUrl = async () => {
        // Generate a proper PKCE flow
        const baseUrl = window.location.origin;
        const clientId = '228760319328-g2tmjubea6q0ftpuuuab6p23647eht53.apps.googleusercontent.com';

        // Generate proper PKCE values
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const baseState = 'manual-test-' + Math.random().toString(36).substring(7);

        // Include code verifier in state for testing purposes
        const stateWithVerifier = JSON.stringify({
            originalState: baseState,
            codeVerifier: codeVerifier
        });

        const authUrl = `${baseUrl}/api/auth/authorize?` + new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            redirect_uri: `${baseUrl}/oauth/callback`,
            state: stateWithVerifier,
            resource: `${baseUrl}/api/mcp`
        }).toString();

        setAuthUrl(authUrl);
        return authUrl;
    };

    const generateSimpleAuthUrl = () => {
        // Generate a simple authorization URL without PKCE for comparison
        const baseUrl = window.location.origin;
        const clientId = '228760319328-g2tmjubea6q0ftpuuuab6p23647eht53.apps.googleusercontent.com';

        const state = 'simple-test-' + Math.random().toString(36).substring(7);

        const authUrl = `${baseUrl}/api/auth/authorize?` + new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: `${baseUrl}/oauth/callback`,
            state: state
        }).toString();

        setAuthUrl(authUrl);
        return authUrl;
    };

    const testOAuthFlow = async () => {
        setTestResult('Testing OAuth flow with PKCE...');

        try {
            // Generate and open the auth URL
            const url = await generateAuthUrl();
            window.open(url, '_blank');

            setTestResult('PKCE OAuth URL opened in new tab. Complete the authorization and check the console for results.');

        } catch (error) {
            setTestResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const testSimpleOAuthFlow = async () => {
        setTestResult('Testing simple OAuth flow (no PKCE)...');

        try {
            const url = generateSimpleAuthUrl();
            window.open(url, '_blank');

            setTestResult('Simple OAuth URL opened in new tab. Complete the authorization and check the console for results.');

        } catch (error) {
            setTestResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const testEndpoints = async () => {
        setTestResult('Testing OAuth endpoints...');

        try {
            const baseUrl = window.location.origin;

            // Test authorization server metadata
            const authServerResponse = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
            const authServerData = await authServerResponse.json();

            // Test protected resource metadata
            const protectedResourceResponse = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
            const protectedResourceData = await protectedResourceResponse.json();

            setTestResult(`✅ OAuth endpoints working:
Authorization Server: ${authServerResponse.status}
Protected Resource: ${protectedResourceResponse.status}

Auth Server Data: ${JSON.stringify(authServerData, null, 2)}

Protected Resource Data: ${JSON.stringify(protectedResourceData, null, 2)}`);

        } catch (error) {
            setTestResult(`❌ Error testing endpoints: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">OAuth Debug Page</h1>

            <div className="space-y-4">
                <div className="bg-gray-100 p-4 rounded">
                    <h2 className="text-lg font-semibold mb-2">Test OAuth Endpoints</h2>
                    <button
                        onClick={testEndpoints}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                        Test OAuth Metadata Endpoints
                    </button>
                </div>

                <div className="bg-gray-100 p-4 rounded">
                    <h2 className="text-lg font-semibold mb-2">Simple OAuth Flow Test (No PKCE)</h2>
                    <p className="text-sm text-gray-600 mb-2">
                        Test OAuth without PKCE to verify basic flow works.
                    </p>
                    <button
                        onClick={testSimpleOAuthFlow}
                        className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 mr-2"
                    >
                        Test Simple OAuth Flow
                    </button>
                </div>

                <div className="bg-gray-100 p-4 rounded">
                    <h2 className="text-lg font-semibold mb-2">PKCE OAuth Flow Test</h2>
                    <p className="text-sm text-gray-600 mb-2">
                        This simulates what Claude Desktop does when connecting to the MCP server.
                    </p>
                    <button
                        onClick={testOAuthFlow}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                    >
                        Test PKCE OAuth Flow
                    </button>
                </div>

                {authUrl && (
                    <div className="bg-yellow-50 p-4 rounded">
                        <h3 className="font-semibold mb-2">Generated Auth URL:</h3>
                        <div className="text-xs break-all bg-white p-2 rounded border">
                            {authUrl}
                        </div>
                        <a
                            href={authUrl}
                            target="_blank"
                            className="inline-block mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                        >
                            Open in New Tab
                        </a>
                    </div>
                )}

                {testResult && (
                    <div className="bg-white p-4 rounded border">
                        <h3 className="font-semibold mb-2">Test Results:</h3>
                        <pre className="text-xs whitespace-pre-wrap">{testResult}</pre>
                    </div>
                )}
            </div>

            <div className="mt-8 bg-blue-50 p-4 rounded">
                <h2 className="text-lg font-semibold mb-2">Claude Desktop Configuration</h2>
                <p className="text-sm mb-2">Use this configuration in your Claude Desktop settings:</p>
                <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                    {`{
  "mcpServers": {
    "clerk-hello-world": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3000/api/mcp"
      ],
      "oauth": {
        "authorization_server": "http://localhost:3000/.well-known/oauth-authorization-server",
        "protected_resource": "http://localhost:3000/.well-known/oauth-protected-resource"
      }
    }
  }
}`}
                </pre>
            </div>
        </div>
    );
}