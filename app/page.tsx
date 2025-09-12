"use client";

import { useMemo, useState } from "react";
import { sayHello as sayHelloAction } from "@/app/actions/mcp-actions";
import baseContent from "@/lib/content.json";
import { getMcpEndpointUrl, resolveApiDomain } from "@/lib/url-resolver";

// Type for testing methods that may have additional properties
type TestMethod = {
  name: string;
  description: string;
  example?: string | object;
  url?: string;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("testing");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testToken, setTestToken] = useState("");

  // Generate dynamic content with resolved URLs
  const content = useMemo(() => {
    const apiDomain = resolveApiDomain();
    const mcpEndpoint = getMcpEndpointUrl();
    const protectedResourceUrl = `${apiDomain}/.well-known/oauth-protected-resource`;
    const serverHost = new URL(apiDomain).host;

    // Helper function to replace placeholders in strings
    const replacePlaceholders = (str: string): string => {
      return str
        .replace(/\{\{MCP_ENDPOINT\}\}/g, mcpEndpoint)
        .replace(/\{\{PROTECTED_RESOURCE_URL\}\}/g, protectedResourceUrl)
        .replace(/\{\{API_DOMAIN\}\}/g, apiDomain)
        .replace(/\{\{SERVER_HOST\}\}/g, serverHost);
    };

    // Helper function to recursively replace placeholders in objects
    const replaceInObject = (obj: unknown): unknown => {
      if (typeof obj === "string") {
        return replacePlaceholders(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map((item) => replaceInObject(item));
      }
      if (obj && typeof obj === "object") {
        const newObj: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          newObj[key] = replaceInObject(value);
        }
        return newObj;
      }
      return obj;
    };

    return replaceInObject(baseContent) as typeof baseContent;
  }, []);

  const handleQuickTest = async () => {
    setLoading(true);
    try {
      const response = await sayHelloAction("Documentation Reader");
      if (response.success && response.result) {
        setTestResult(
          `✅ Server Action Test: ${response.result.content[0].text}`,
        );
      } else if (response.error) {
        setTestResult(`❌ Server Action Error: ${response.error.message}`);
      }
    } catch (error) {
      setTestResult(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTestAuthenticated = async () => {
    setLoading(true);
    try {
      if (!testToken.trim()) {
        setTestResult("❌ Error: Please enter a Google ID token");
        return;
      }

      // Test authenticated MCP call with dynamic endpoint
      const response = await fetch(getMcpEndpointUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "say_hello",
            arguments: {
              name: "Authenticated User",
            },
          },
        }),
      });

      const data = await response.json();
      if (data.result) {
        setTestResult(`✅ Authenticated MCP: ${data.result.content[0].text}`);
      } else if (data.error) {
        setTestResult(`❌ MCP Error: ${data.error.message}`);
      }
    } catch (error) {
      setTestResult(
        `❌ Network Error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
          id: 1,
          method: "tools/call",
          params: {
            name: "say_hello",
            arguments: {
              name: "Test User",
            },
          },
        }),
      });

      if (response.status === 401) {
        const errorData = await response.json();
        setTestResult(
          `✅ Authentication required (expected): ${errorData.error?.message || "Unauthorized"}`,
        );
      } else {
        const data = await response.json();
        setTestResult(`❌ Unexpected response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      setTestResult(
        `❌ Network Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // Tab navigation component
  const TabButton = ({ id, label }: { id: string; label: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`nav-button ${activeTab === id ? "active" : "inactive"}`}
    >
      {label}
    </button>
  );

  // Code block component with copy functionality
  const CodeBlock = ({ code }: { code: string }) => (
    <div className="code-container">
      <pre className="code-block">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => copyToClipboard(code)}
        className="copy-button"
      >
        Copy
      </button>
    </div>
  );

  return (
    <div className="doc-container">
      <header className="doc-header">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="doc-title">{content.title}</h1>
          <p className="doc-subtitle">{content.subtitle}</p>
          <p className="doc-description">{content.description}</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="max-w-6xl mx-auto px-6 py-4">
        <div className="doc-nav">
          <TabButton id="testing" label="Testing" />
          <TabButton id="architecture" label="Architecture" />
          <TabButton id="tools" label="Tools" />
          <TabButton id="oauth" label="OAuth 2.1" />
          <TabButton id="integration" label="Integration" />
          <TabButton id="endpoints" label="Endpoints" />
          <TabButton id="security" label="Security" />
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 pb-12">
        <div className="doc-content">
          {/* Testing Tab */}
          {activeTab === "testing" && (
            <div>
              <h2 className="section-title">{content.testing.title}</h2>
              <p className="section-description">
                {content.testing.description}
              </p>

              {/* Quick Test Section */}
              <div className="test-container">
                <h3 className="test-title">Live Server Testing</h3>

                {/* Test Buttons */}
                <div className="test-buttons">
                  <button
                    type="button"
                    onClick={handleQuickTest}
                    disabled={loading}
                    className="test-button primary"
                  >
                    {loading ? "Testing..." : "Test Server Action"}
                  </button>

                  <button
                    type="button"
                    onClick={handleTestUnauthenticated}
                    disabled={loading}
                    className="test-button primary"
                  >
                    {loading ? "Testing..." : "Test Unauthenticated (401)"}
                  </button>
                </div>

                {/* Authenticated Test Section */}
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="test-token"
                      className="block text-sm font-medium mb-2 text-gray-300"
                    >
                      Google ID Token (for authenticated testing):
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="test-token"
                        type="password"
                        value={testToken}
                        onChange={(e) => setTestToken(e.target.value)}
                        placeholder="Enter your Google ID token..."
                        className="test-input"
                      />
                      <button
                        type="button"
                        onClick={handleTestAuthenticated}
                        disabled={loading || !testToken.trim()}
                        className="test-button success"
                      >
                        {loading ? "Testing..." : "Test Authenticated"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Get this from Google OAuth flow or{" "}
                      <a
                        href="https://developers.google.com/oauthplayground"
                        className="text-blue-400 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        OAuth 2.0 Playground
                      </a>
                    </p>
                  </div>
                </div>

                {/* Test Result Display */}
                {testResult && (
                  <div className="test-result">
                    <h4 className="test-result-title">Test Result:</h4>
                    <pre className="test-result-content">{testResult}</pre>
                  </div>
                )}
              </div>

              {/* Testing Methods */}
              <h3 className="section-title text-xl mt-8">Testing Methods</h3>
              <div className="component-grid">
                {content.testing.methods.map((method) => {
                  const testMethod = method as TestMethod;
                  return (
                    <div key={method.name} className="component-card">
                      <h4 className="component-title">{method.name}</h4>
                      <p className="component-description">
                        {method.description}
                      </p>
                      {testMethod.example && (
                        <div className="mt-3">
                          <h5 className="text-sm font-semibold mb-2 text-blue-300">
                            Example:
                          </h5>
                          <CodeBlock
                            code={
                              typeof testMethod.example === "string"
                                ? testMethod.example
                                : JSON.stringify(testMethod.example, null, 2)
                            }
                          />
                        </div>
                      )}
                      {testMethod.url && (
                        <div className="mt-2">
                          <a
                            href={testMethod.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline text-sm"
                          >
                            {testMethod.url}
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Architecture Tab */}
          {activeTab === "architecture" && (
            <div>
              <h2 className="section-title">{content.architecture.title}</h2>
              <p className="section-description">
                {content.architecture.description}
              </p>

              {/* Components Grid */}
              <div className="component-grid">
                {content.architecture.components.map((component) => (
                  <div key={component.name} className="component-card">
                    <h3 className="component-title">{component.name}</h3>
                    <code className="component-path">{component.path}</code>
                    <p className="component-description">
                      {component.description}
                    </p>
                    <ul className="feature-list">
                      {component.features.map((feature) => (
                        <li key={feature} className="feature-item">
                          <span className="feature-check">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tools Tab */}
          {activeTab === "tools" && (
            <div>
              <h2 className="section-title">{content.tools.title}</h2>
              <p className="section-description">{content.tools.description}</p>

              <div className="component-grid">
                {content.tools.list.map((tool) => (
                  <div key={tool.name} className="component-card">
                    <h4 className="component-title">{tool.name}</h4>
                    <p className="component-description">{tool.description}</p>
                    <div className="mt-3">
                      <h5 className="text-sm font-semibold mb-2 text-blue-300">
                        Example Usage:
                      </h5>
                      <CodeBlock code={JSON.stringify(tool.example, null, 2)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OAuth 2.1 Tab */}
          {activeTab === "oauth" && (
            <div>
              <h2 className="section-title">
                {content.oauth21Compliance.title}
              </h2>
              <p className="section-description">
                {content.oauth21Compliance.description}
              </p>

              {/* OAuth Features Grid */}
              <div className="oauth-grid">
                {content.oauth21Compliance.features.map((feature) => (
                  <div key={feature.name} className="oauth-card">
                    <div className="oauth-title">
                      <span className="oauth-check">✅</span>
                      <h3>{feature.name}</h3>
                    </div>
                    <p className="oauth-description">{feature.description}</p>
                    <div className="oauth-status">{feature.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Integration Tab */}
          {activeTab === "integration" && (
            <div>
              <h2 className="section-title">Integration Guide</h2>

              {/* VS Code Setup */}
              <div className="mb-8">
                <h3 className="component-title text-2xl mb-4">
                  {content.integrations.vsCode.title}
                </h3>
                <p className="section-description">
                  {content.integrations.vsCode.description}
                </p>

                <div className="steps-container">
                  {content.integrations.vsCode.steps.map((step) => (
                    <div key={step.step} className="step-item">
                      <h4 className="step-title">
                        Step {step.step}: {step.title}
                      </h4>
                      <p className="step-description">{step.description}</p>
                      {step.code && (
                        <div className="mt-3">
                          <CodeBlock code={step.code} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Claude Desktop Setup */}
              <div>
                <h3 className="component-title text-2xl mb-4">
                  {content.integrations.claudeDesktop.title}
                </h3>
                <p className="section-description">
                  {content.integrations.claudeDesktop.description}
                </p>

                <div className="steps-container">
                  {content.integrations.claudeDesktop.steps.map((step) => (
                    <div key={step.step} className="step-item">
                      <h4 className="step-title">
                        Step {step.step}: {step.title}
                      </h4>
                      <p className="step-description">{step.description}</p>
                      {step.code && (
                        <div className="mt-3">
                          <CodeBlock code={step.code} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Endpoints Tab */}
          {activeTab === "endpoints" && (
            <div>
              <h2 className="section-title">{content.endpoints.title}</h2>

              {/* Endpoints List */}
              <div className="endpoint-list">
                {content.endpoints.list.map((endpoint) => (
                  <div key={endpoint.path} className="endpoint-item">
                    <div className="endpoint-header">
                      <span
                        className={`method-badge method-${endpoint.method.toLowerCase()}`}
                      >
                        {endpoint.method}
                      </span>
                      <code className="endpoint-path">{endpoint.path}</code>
                    </div>
                    <p className="endpoint-description">
                      {endpoint.description}
                    </p>
                    <div className="endpoint-details">
                      <div className="endpoint-detail">
                        <strong>Authentication:</strong>{" "}
                        {endpoint.authentication}
                      </div>
                      <div className="endpoint-detail">
                        <strong>CORS:</strong> {endpoint.cors}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div>
              <h2 className="section-title">{content.security.title}</h2>
              <p className="section-description">
                {content.security.description}
              </p>

              {/* Security Features Grid */}
              <div className="security-grid">
                {content.security.features.map((feature) => (
                  <div key={feature.name} className="security-item">
                    <h3 className="security-title">{feature.name}</h3>
                    <p className="security-description">
                      {feature.description}
                    </p>
                    <div className="security-implementation">
                      <div className="security-implementation-title">
                        Implementation:
                      </div>
                      <div className="security-implementation-text">
                        {feature.implementation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
