// Shared types for OAuth 2.1 authentication
export interface AuthCodeData {
  clientId: string;
  redirectUri: string;
  codeChallenge?: string | null;
  codeChallengeMethod?: string | null;
  resource?: string | null;
  state?: string | null;
  scope?: string;
  createdAt: number;
  expiresAt: number;
  googleTokens?: unknown; // For storing Google tokens
}

// OAuth 2.1 Token Response interface
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string; // For OpenID Connect
}

// Global type declarations
declare global {
  var authCodes: Map<string, AuthCodeData> | undefined;
  var mcpDebugToken: string | undefined;
}
