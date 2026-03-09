import { AuthorizationSession, TokenRecord } from "../types.js";

/**
 * Async storage interface for OAuth token state.
 *
 * Two implementations:
 * - InMemoryTokenStore: for tests (no Redis dependency)
 * - RedisTokenStore: for production (persistence across restarts)
 */
export interface TokenStore {
  // --- Authorization sessions (short-lived, 5 min TTL) ---
  getSession(authCode: string): Promise<AuthorizationSession | undefined>;
  setSession(authCode: string, session: AuthorizationSession, ttlSeconds: number): Promise<void>;
  deleteSession(authCode: string): Promise<void>;
  /** Atomic read-modify-write on a session field (e.g. setting platformCode) */
  updateSession(authCode: string, update: Partial<AuthorizationSession>): Promise<void>;

  // --- Token records (long-lived, 30 day TTL) ---
  getTokenRecord(accessToken: string): Promise<TokenRecord | undefined>;
  setTokenRecord(accessToken: string, record: TokenRecord, ttlSeconds: number): Promise<void>;
  deleteTokenRecord(accessToken: string): Promise<void>;

  // --- Refresh token index (refreshToken → accessToken mapping) ---
  getRefreshIndex(refreshToken: string): Promise<string | undefined>;
  setRefreshIndex(refreshToken: string, accessToken: string, ttlSeconds: number): Promise<void>;
  deleteRefreshIndex(refreshToken: string): Promise<void>;

  // --- Validation cache (accessToken → epoch seconds) ---
  getValidationCache(accessToken: string): Promise<number | undefined>;
  setValidationCache(accessToken: string, epochSeconds: number, ttlSeconds: number): Promise<void>;
  deleteValidationCache(accessToken: string): Promise<void>;

  // --- Lifecycle ---
  ping(): Promise<void>;
  disconnect(): Promise<void>;
}
