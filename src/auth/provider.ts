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
import { InvalidTokenError, ServerError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { TokenStore } from "./token-store.js";
import { ElnoraConfig, TokenRecord } from "../types.js";
import { logAuthEvent } from "../middleware/tool-logging.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  REQUEST_TIMEOUT_MS,
  SUPPORTED_SCOPES,
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
  private _clientsStore: OAuthRegisteredClientsStore;
  private store: TokenStore;
  private config: ElnoraConfig;

  constructor(config: ElnoraConfig, store: TokenStore, clientsStore: OAuthRegisteredClientsStore) {
    this.config = config;
    this.store = store;
    this._clientsStore = clientsStore;
  }

  /** Headers required by the platform's token validation endpoint */
  private get validationHeaders() {
    return { "X-Service-Key": this.config.mcpServiceKey };
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

    // PKCE is mandatory — reject if code_challenge is missing (CoSAI MCP-T1)
    if (!params.codeChallenge) {
      throw new Error("PKCE code_challenge is required");
    }

    // Generate a random state token for the platform callback (CSRF protection)
    const platformState = crypto.randomBytes(16).toString("base64url");

    // Validate requested scopes against supported scopes — reject unsupported scopes early
    const requestedScopes = params.scopes || [];
    const supportedSet = new Set<string>(SUPPORTED_SCOPES);
    const unsupported = requestedScopes.filter((s) => !supportedSet.has(s));
    if (unsupported.length > 0) {
      throw new Error(`Unsupported scopes requested: ${unsupported.join(", ")}`);
    }

    // Store session for later exchange
    await this.store.setSession(authCode, {
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: requestedScopes,
      state: params.state,
      resource: params.resource?.toString(),
      platformState,
      createdAt: Date.now(),
    }, AUTH_CODE_TTL_SECONDS);

    // Redirect to Elnora platform login
    const loginUrl = new URL(this.config.loginUrl);
    loginUrl.searchParams.set("mcp_code", authCode);
    loginUrl.searchParams.set("redirect_uri", `${this.config.publicUrl}/oauth/callback`);
    loginUrl.searchParams.set("client_id", this.config.platformClientId);
    loginUrl.searchParams.set("state", platformState);

    logAuthEvent("authorize_redirect", client.client_id);
    res.redirect(loginUrl.toString());
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const session = await this.store.getSession(authorizationCode);
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
    const session = await this.store.getSession(authorizationCode);
    if (!session) {
      throw new Error("Invalid or expired authorization code");
    }

    if (session.clientId !== client.client_id) {
      await this.store.deleteSession(authorizationCode);
      throw new Error("Authorization code was not issued to this client");
    }

    // Validate redirect_uri matches the one from the authorization request (RFC 6749 §4.1.3)
    // When redirect_uri was included in the authorization request, it MUST be included
    // in the token request and MUST match exactly.
    if (session.redirectUri) {
      if (!redirectUri || redirectUri !== session.redirectUri) {
        logAuthEvent("redirect_uri_mismatch", client.client_id);
        throw new Error("redirect_uri does not match the authorization request");
      }
    }

    if (!session.platformCode) {
      throw new Error("Platform authentication not completed — user must authenticate on the platform first");
    }

    // Exchange with Elnora platform for a platform token BEFORE deleting the session.
    // If the platform exchange fails transiently, the session survives so the user
    // can retry without restarting the full auth flow.
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

    // Auth code is single-use per RFC 6749 — delete after exchange succeeds
    await this.store.deleteSession(authorizationCode);

    // Issue MCP tokens (separate from platform token — CoSAI MCP-T1)
    return this.issueTokens(client.client_id, session.scopes, platformToken, resource?.toString());
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const accessTokenKey = await this.store.getRefreshIndex(refreshToken);
    if (!accessTokenKey) {
      throw new Error("Invalid refresh token");
    }

    const record = await this.store.getTokenRecord(accessTokenKey);
    if (!record || record.clientId !== client.client_id) {
      throw new Error("Invalid refresh token");
    }

    // Validate scope subset constraint (OAuth 2.1: refresh MUST NOT escalate scopes)
    if (scopes !== undefined) {
      if (scopes.length === 0) {
        throw new Error("Scopes array must not be empty — omit the field to keep original scopes");
      }
      const escalated = scopes.filter((s) => !record.scopes.includes(s));
      if (escalated.length > 0) {
        throw new Error(`Scope escalation not allowed. Requested scopes not in original grant: ${escalated.join(", ")}`);
      }
    }

    // Re-validate platform token before issuing new tokens — ensures revoked
    // platform sessions don't survive through refresh (CoSAI MCP-T7)
    try {
      const validation = await axios.post(
        this.config.tokenValidationUrl,
        { token: record.platformToken },
        { timeout: REQUEST_TIMEOUT_MS, headers: this.validationHeaders },
      );
      if (!validation.data.valid) {
        await this.store.deleteTokenRecord(accessTokenKey);
        await this.store.deleteRefreshIndex(refreshToken);
        await this.store.deleteValidationCache(accessTokenKey);
        logAuthEvent("refresh_platform_token_revoked", client.client_id);
        throw new Error("Underlying platform token has been revoked");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Underlying platform token has been revoked") {
        throw error;
      }
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await this.store.deleteTokenRecord(accessTokenKey);
        await this.store.deleteRefreshIndex(refreshToken);
        await this.store.deleteValidationCache(accessTokenKey);
        logAuthEvent("refresh_platform_token_revoked", client.client_id);
        throw new Error("Underlying platform token has been revoked");
      }
      logAuthEvent("refresh_platform_validation_error", client.client_id, { error: String(error) });
      throw new Error("Platform token validation unavailable — please retry");
    }

    // Rotate: delete old tokens
    await this.store.deleteTokenRecord(accessTokenKey);
    await this.store.deleteRefreshIndex(refreshToken);
    await this.store.deleteValidationCache(accessTokenKey);

    logAuthEvent("refresh_token_rotation", client.client_id, {
      previousScopes: record.scopes,
      requestedScopes: scopes || record.scopes,
    });

    // Issue new tokens with the validated platform token
    return this.issueTokens(
      client.client_id,
      scopes || record.scopes,
      record.platformToken,
      resource?.toString() || record.resource,
    );
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = await this.store.getTokenRecord(token);
    if (!record) {
      throw new InvalidTokenError("Invalid access token");
    }

    if (record.expiresAt < Math.floor(Date.now() / 1000)) {
      await this.store.deleteTokenRecord(token);
      await this.store.deleteValidationCache(token);
      await this.store.deleteRefreshIndex(record.refreshToken);
      throw new InvalidTokenError("Access token expired");
    }

    // Check validation cache — skip platform round-trip if recently validated
    const now = Math.floor(Date.now() / 1000);
    const cachedAt = await this.store.getValidationCache(token);
    if (cachedAt && (now - cachedAt) < VALIDATION_CACHE_TTL_SECONDS) {
      return {
        token,
        clientId: record.clientId,
        scopes: record.scopes,
        expiresAt: record.expiresAt,
        resource: record.resource ? new URL(record.resource) : undefined,
      };
    }

    // Validate platform token is still valid
    try {
      const validation = await axios.post(
        this.config.tokenValidationUrl,
        { token: record.platformToken },
        { timeout: REQUEST_TIMEOUT_MS, headers: this.validationHeaders },
      );
      if (!validation.data.valid) {
        await this.store.deleteTokenRecord(token);
        await this.store.deleteValidationCache(token);
        await this.store.deleteRefreshIndex(record.refreshToken);
        throw new InvalidTokenError("Underlying platform token revoked");
      }
      // Cache successful validation
      await this.store.setValidationCache(token, Math.floor(Date.now() / 1000), VALIDATION_CACHE_TTL_SECONDS);
    } catch (error) {
      // Re-throw our own revocation errors (from the valid:false check above)
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await this.store.deleteTokenRecord(token);
        await this.store.deleteValidationCache(token);
        await this.store.deleteRefreshIndex(record.refreshToken);
        throw new InvalidTokenError("Underlying platform token revoked");
      }
      // Network errors — fail-closed for security (SOC 2 / pharma revocation requirements).
      // Reject the request and force retry on next call.
      logAuthEvent("platform_validation_network_error", record.clientId, { error: String(error) });
      throw new ServerError("Platform token validation unavailable — please retry");
    }

    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
      resource: record.resource ? new URL(record.resource) : undefined,
    };
  }

  /**
   * Retrieve the platform token for a validated MCP access token.
   * Used by index.ts to construct the API client — keeps platform tokens
   * out of AuthInfo.extra (CoSAI MCP-T1: no token passthrough).
   */
  async getPlatformToken(accessToken: string): Promise<string | undefined> {
    const record = await this.store.getTokenRecord(accessToken);
    return record?.platformToken;
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const token = request.token;

    // Check if it's an access token
    const record = await this.store.getTokenRecord(token);
    if (record && record.clientId === client.client_id) {
      await this.store.deleteRefreshIndex(record.refreshToken);
      await this.store.deleteTokenRecord(token);
      await this.store.deleteValidationCache(token);
      logAuthEvent("access_token_revoked", client.client_id);
      return;
    }

    // Check if it's a refresh token
    const accessTokenKey = await this.store.getRefreshIndex(token);
    if (accessTokenKey) {
      const rec = await this.store.getTokenRecord(accessTokenKey);
      if (rec && rec.clientId === client.client_id) {
        await this.store.deleteTokenRecord(accessTokenKey);
        await this.store.deleteValidationCache(accessTokenKey);
        await this.store.deleteRefreshIndex(token);
        logAuthEvent("refresh_token_revoked", client.client_id);
      }
    }
  }

  /**
   * Handle the callback from the Elnora platform login and return the
   * client redirect URL atomically (single session lookup, no race window).
   * Verifies platformState to prevent CSRF / code substitution attacks.
   */
  async handlePlatformCallback(mcpCode: string, platformCode: string, platformState: string): Promise<string> {
    const session = await this.store.getSession(mcpCode);
    if (!session) {
      throw new Error("Invalid or expired MCP authorization code");
    }

    // Verify state parameter matches what we sent to prevent CSRF (CoSAI MCP-T7)
    if (!platformState || platformState !== session.platformState) {
      logAuthEvent("platform_callback_state_mismatch", session.clientId);
      throw new Error("State parameter mismatch — possible CSRF attack");
    }

    // Prevent callback replay — each callback can only be processed once
    // Use strict undefined check: empty string is also invalid (defense-in-depth)
    if (session.platformCode !== undefined) {
      throw new Error("Authorization callback already processed");
    }

    // Validate platformCode is non-empty
    if (!platformCode) {
      throw new Error("Platform authorization code is empty");
    }

    // Store the platform code for later exchange
    await this.store.updateSession(mcpCode, { platformCode });

    logAuthEvent("platform_callback_completed", session.clientId);

    // Validate redirect_uri against registered client before redirecting (prevents open redirect)
    const clientRecord = await this._clientsStore.getClient(session.clientId);
    if (!clientRecord?.redirect_uris?.includes(session.redirectUri)) {
      logAuthEvent("redirect_uri_not_registered", session.clientId, { redirectUri: session.redirectUri });
      throw new Error("Redirect URI not registered for client");
    }

    // Build redirect URL in the same call — no second lookup needed
    const redirectUrl = new URL(session.redirectUri);
    redirectUrl.searchParams.set("code", mcpCode);
    if (session.state) {
      redirectUrl.searchParams.set("state", session.state);
    }
    return redirectUrl.toString();
  }

  private async issueTokens(
    clientId: string,
    scopes: string[],
    platformToken: string,
    resource?: string,
  ): Promise<OAuthTokens> {
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

    await this.store.setTokenRecord(accessToken, record, REFRESH_TOKEN_TTL_SECONDS);
    await this.store.setRefreshIndex(refreshToken, accessToken, REFRESH_TOKEN_TTL_SECONDS);

    logAuthEvent("tokens_issued", clientId, { expiresAt: new Date((now + ACCESS_TOKEN_TTL_SECONDS) * 1000).toISOString() });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
    };
  }
}
