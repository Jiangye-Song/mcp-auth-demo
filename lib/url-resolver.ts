export function resolveApiDomain(): string {
  // Client-side resolution (when window is available)
  if (typeof window !== "undefined") {
    // Use the current browser location for client-side
    const { protocol, host } = window.location;
    return `${protocol}//${host}`;
  }

  // Server-side resolution
  // Priority order for external-facing URLs:

  // 1. Custom domain from environment variable (for manual override)
  if (process.env.CUSTOM_DOMAIN) {
    return `https://${process.env.CUSTOM_DOMAIN}`;
  }

  // 2. Vercel's production URL (best for external-facing, includes custom domains)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // 3. Next.js public URL (for manual configuration)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 4. Fallback to localhost for development
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

export function getBaseApiUrl(): string {
  return `${resolveApiDomain()}/api`;
}

export function getMcpEndpointUrl(): string {
  return `${getBaseApiUrl()}/mcp`;
}

export function isLocalDevelopment(): boolean {
  return resolveApiDomain().includes("localhost");
}
