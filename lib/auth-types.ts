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
  googleTokens?: GoogleTokens; // For storing Google tokens
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

// Google OAuth token structure
export interface GoogleTokens {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

// OAuth 2.1 Error Response interface
export interface OAuth21ErrorResponse {
  error: string;
  error_description: string;
  error_uri?: string;
  state?: string;
  oauth_version?: "2.1";
  compliance_note?: string;
  details?: string;
}

// CORS configuration interface
export interface CORSConfig {
  origin: string;
  methods: string;
  headers: string;
  maxAge?: string;
}

// Common OAuth 2.1 parameter validation interface
export interface OAuth21AuthParams {
  response_type?: string | null;
  client_id?: string | null;
  redirect_uri?: string | null;
  scope?: string | null;
  state?: string | null;
  code_challenge?: string | null;
  code_challenge_method?: string | null;
  resource?: string | null;
}

// Token exchange parameters
export interface TokenExchangeParams {
  grant_type?: string | null;
  code?: string | null;
  redirect_uri?: string | null;
  client_id?: string | null;
  code_verifier?: string | null;
}

// Global type declarations
declare global {
  var authCodes: Map<string, AuthCodeData> | undefined;
  var mcpDebugToken: string | undefined;
}
