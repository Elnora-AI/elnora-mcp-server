import crypto from "node:crypto";
import { Response } from "express";
import axios from "axios";
import { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InMemoryClientsStore } from "./clients-store.js";
import { ElnoraConfig, AuthorizationSession, TokenRecord } from "../types.js";
import { logAuthEvent } from "../middleware/tool-logging.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  REQUEST_TIMEOUT_MS,
} from "../constants.js";

/**
 * OAuth 2.1 provider that proxies to the Elnora platform auth system.
 *
 * Flow:
 * 1. MCP client calls /authorize → provider redirects to Elnora platform login
 * 2. User authenticates on platform → platform redirects back with platform auth code
 * 3. MCP server exchanges platform code for platform token
 * 4. MCP server issues its own access + refresh tokens, mapped to the platform token
 * 5. On token validation, the provider checks its own token store and validates
 *    the underlying platform token hasn't been revoked
 *
 * CoSAI controls:
 * - MCP-T1: PKCE S256 mandatory (handled by SDK)
 * - MCP-T1: No token passthrough — MCP tokens are separate from platform tokens
 * - MCP-T7: Short-lived access tokens (1h), refresh token rotation
 * - MCP-T9: Audience binding via resource parameter
 * - MCP-T12: Auth event logging
 */
/** TTL for platform token validation cache (seconds) */
const VALIDATION_CACHE_TTL_SECONDS = 30;

export class ElnoraOAuthProvider implements OAuthServerProvider {
  private _clientsStore: InMemoryClientsStore;
  private authSessions = new Map<string, AuthorizationSession>();
  private tokenRecords = new Map<string, TokenRecord>();
  private refreshTokenIndex = new Map<string, string>(); // refreshToken -> accessToken
  private validationCache = new Map<string, number>(); // accessToken -> validatedAt (epoch seconds)
  private config: ElnoraConfig;

  constructor(config: ElnoraConfig) {
    this.config = config;
    this._clientsStore = new InMemoryClientsStore();
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }

  /**
   * Redirect the user to the Elnora platform login page.
   * After authentication, the platform redirects back to our callback,
   * which completes the OAuth flow back to the MCP client.
   */
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const authCode = crypto.randomBytes(32).toString("base64url");

    // Store session for later exchange
    this.authSessions.set(authCode, {
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: params.scopes || [],
      state: params.state,
      resource: params.resource?.toString(),
      createdAt: Date.now(),
    });

    // Schedule cleanup of expired sessions (unref so timer doesn't pin process)
    setTimeout(() => this.authSessions.delete(authCode), AUTH_CODE_TTL_SECONDS * 1000).unref();

    // Redirect to Elnora platform login
    const loginUrl = new URL(this.config.loginUrl);
    loginUrl.searchParams.set("mcp_code", authCode);
    loginUrl.searchParams.set("redirect_uri", `${this.config.publicUrl}/oauth/callback`);
    loginUrl.searchParams.set("client_id", this.config.platformClientId);

    logAuthEvent("authorize_redirect", client.client_id);
    res.redirect(loginUrl.toString());
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const session = this.authSessions.get(authorizationCode);
    if (!session) {
      throw new Error("Invalid or expired authorization code");
    }
    return session.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const session = this.authSessions.get(authorizationCode);
    if (!session) {
      throw new Error("Invalid or expired authorization code");
    }

    if (session.clientId !== client.client_id) {
      throw new Error("Authorization code was not issued to this client");
    }

    // Validate redirect_uri matches the one from the authorization request (RFC 6749 §4.1.3)
    if (redirectUri && redirectUri !== session.redirectUri) {
      logAuthEvent("redirect_uri_mismatch", client.client_id);
      throw new Error("redirect_uri does not match the authorization request");
    }

    // Delete the auth code — single use only
    this.authSessions.delete(authorizationCode);

    if (!session.platformCode) {
      throw new Error("Platform authentication not completed — user must authenticate on the platform first");
    }

    // Exchange with Elnora platform for a platform token
    let platformToken: string;
    try {
      const response = await axios.post<{ access_token: string }>(
        this.config.tokenExchangeUrl,
        {
          grant_type: "authorization_code",
          code: session.platformCode,
          client_id: this.config.platformClientId,
          client_secret: this.config.platformClientSecret,
        },
        { timeout: REQUEST_TIMEOUT_MS },
      );
      platformToken = response.data.access_token;
    } catch (error) {
      logAuthEvent("platform_token_exchange_failed", client.client_id, { error: String(error) });
      throw new Error("Failed to exchange authorization code with platform");
    }

    // Issue MCP tokens (separate from platform token — CoSAI MCP-T1)
    return this.issueTokens(client.client_id, session.scopes, platformToken, resource?.toString());
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const accessTokenKey = this.refreshTokenIndex.get(refreshToken);
    if (!accessTokenKey) {
      throw new Error("Invalid refresh token");
    }

    const record = this.tokenRecords.get(accessTokenKey);
    if (!record || record.clientId !== client.client_id) {
      throw new Error("Invalid refresh token");
    }

    // Validate scope subset constraint (OAuth 2.1: refresh MUST NOT escalate scopes)
    if (scopes && scopes.length > 0) {
      const escalated = scopes.filter((s) => !record.scopes.includes(s));
      if (escalated.length > 0) {
        throw new Error(`Scope escalation not allowed. Requested scopes not in original grant: ${escalated.join(", ")}`);
      }
    }

    // Rotate: delete old tokens
    this.tokenRecords.delete(accessTokenKey);
    this.refreshTokenIndex.delete(refreshToken);
    this.validationCache.delete(accessTokenKey);

    logAuthEvent("refresh_token_rotation", client.client_id, {
      previousScopes: record.scopes,
      requestedScopes: scopes || record.scopes,
    });

    // Issue new tokens with the same platform token
    return this.issueTokens(
      client.client_id,
      scopes || record.scopes,
      record.platformToken,
      resource?.toString() || record.resource,
    );
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = this.tokenRecords.get(token);
    if (!record) {
      throw new Error("Invalid access token");
    }

    if (record.expiresAt < Math.floor(Date.now() / 1000)) {
      this.tokenRecords.delete(token);
      this.validationCache.delete(token);
      throw new Error("Access token expired");
    }

    // Check validation cache — skip platform round-trip if recently validated
    const now = Math.floor(Date.now() / 1000);
    const cachedAt = this.validationCache.get(token);
    if (cachedAt && (now - cachedAt) < VALIDATION_CACHE_TTL_SECONDS) {
      return {
        token,
        clientId: record.clientId,
        scopes: record.scopes,
        expiresAt: record.expiresAt,
        resource: record.resource ? new URL(record.resource) : undefined,
        extra: { platformToken: record.platformToken },
      };
    }

    // Validate platform token is still valid
    try {
      const validation = await axios.post(
        this.config.tokenValidationUrl,
        { token: record.platformToken },
        { timeout: REQUEST_TIMEOUT_MS },
      );
      if (!validation.data.valid) {
        this.tokenRecords.delete(token);
        this.validationCache.delete(token);
        throw new Error("Underlying platform token revoked");
      }
      // Cache successful validation
      this.validationCache.set(token, Math.floor(Date.now() / 1000));
    } catch (error) {
      // Re-throw our own revocation errors (from the valid:false check above)
      if (error instanceof Error && error.message === "Underlying platform token revoked") {
        throw error;
      }
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        this.tokenRecords.delete(token);
        this.validationCache.delete(token);
        throw new Error("Underlying platform token revoked");
      }
      // Network errors — don't invalidate, just log
      logAuthEvent("platform_validation_network_error", record.clientId, { error: String(error) });
    }

    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
      resource: record.resource ? new URL(record.resource) : undefined,
      extra: { platformToken: record.platformToken },
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const token = request.token;

    // Check if it's an access token
    const record = this.tokenRecords.get(token);
    if (record && record.clientId === client.client_id) {
      this.refreshTokenIndex.delete(record.refreshToken);
      this.tokenRecords.delete(token);
      this.validationCache.delete(token);
      logAuthEvent("access_token_revoked", client.client_id);
      return;
    }

    // Check if it's a refresh token
    const accessTokenKey = this.refreshTokenIndex.get(token);
    if (accessTokenKey) {
      const rec = this.tokenRecords.get(accessTokenKey);
      if (rec && rec.clientId === client.client_id) {
        this.tokenRecords.delete(accessTokenKey);
        this.validationCache.delete(accessTokenKey);
        this.refreshTokenIndex.delete(token);
        logAuthEvent("refresh_token_revoked", client.client_id);
      }
    }
  }

  /**
   * Handle the callback from the Elnora platform login.
   * Called by the /oauth/callback route after the user authenticates.
   */
  handlePlatformCallback(mcpCode: string, platformCode: string): void {
    const session = this.authSessions.get(mcpCode);
    if (!session) {
      throw new Error("Invalid or expired MCP authorization code");
    }

    // Store the platform code for later exchange
    session.platformCode = platformCode;

    logAuthEvent("platform_callback_completed", session.clientId);
  }

  /**
   * Get redirect URL for MCP client after platform callback.
   */
  getClientRedirectUrl(mcpCode: string): string {
    const session = this.authSessions.get(mcpCode);
    if (!session) {
      throw new Error("Invalid or expired MCP authorization code");
    }

    const redirectUrl = new URL(session.redirectUri);
    redirectUrl.searchParams.set("code", mcpCode);
    if (session.state) {
      redirectUrl.searchParams.set("state", session.state);
    }
    return redirectUrl.toString();
  }

  private issueTokens(
    clientId: string,
    scopes: string[],
    platformToken: string,
    resource?: string,
  ): OAuthTokens {
    const accessToken = crypto.randomBytes(32).toString("base64url");
    const refreshToken = crypto.randomBytes(32).toString("base64url");
    const now = Math.floor(Date.now() / 1000);

    const record: TokenRecord = {
      accessToken,
      refreshToken,
      platformToken,
      clientId,
      scopes,
      resource,
      expiresAt: now + ACCESS_TOKEN_TTL_SECONDS,
      createdAt: now,
    };

    this.tokenRecords.set(accessToken, record);
    this.refreshTokenIndex.set(refreshToken, accessToken);

    // Schedule cleanup of expired tokens (cap at ~24 days to stay within 32-bit setTimeout limit)
    const cleanupMs = Math.min(REFRESH_TOKEN_TTL_SECONDS * 1000, 2_000_000_000);
    setTimeout(() => {
      this.tokenRecords.delete(accessToken);
      this.refreshTokenIndex.delete(refreshToken);
      this.validationCache.delete(accessToken);
    }, cleanupMs).unref();

    logAuthEvent("tokens_issued", clientId, { expiresAt: new Date((now + ACCESS_TOKEN_TTL_SECONDS) * 1000).toISOString() });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
    };
  }
}
