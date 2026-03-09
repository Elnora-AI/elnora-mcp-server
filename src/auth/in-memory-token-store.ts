import { AuthorizationSession, TokenRecord } from "../types.js";
import { TokenStore } from "./token-store.js";

/**
 * In-memory TokenStore backed by Maps with setTimeout-based TTL.
 * Used by tests (no Redis dependency) and as a development fallback.
 */
export class InMemoryTokenStore implements TokenStore {
  private sessions = new Map<string, AuthorizationSession>();
  private tokenRecords = new Map<string, TokenRecord>();
  private refreshIndex = new Map<string, string>();
  private validationCache = new Map<string, number>();

  // --- Sessions ---
  async getSession(authCode: string): Promise<AuthorizationSession | undefined> {
    return this.sessions.get(authCode);
  }

  async setSession(authCode: string, session: AuthorizationSession, ttlSeconds: number): Promise<void> {
    this.sessions.set(authCode, session);
    setTimeout(() => this.sessions.delete(authCode), ttlSeconds * 1000).unref();
  }

  async deleteSession(authCode: string): Promise<void> {
    this.sessions.delete(authCode);
  }

  async updateSession(authCode: string, update: Partial<AuthorizationSession>): Promise<void> {
    const session = this.sessions.get(authCode);
    if (session) {
      Object.assign(session, update);
    }
  }

  // --- Token records ---
  async getTokenRecord(accessToken: string): Promise<TokenRecord | undefined> {
    return this.tokenRecords.get(accessToken);
  }

  async setTokenRecord(accessToken: string, record: TokenRecord, ttlSeconds: number): Promise<void> {
    this.tokenRecords.set(accessToken, record);
    // 30-day TTL (2,592,000,000 ms) exceeds the 32-bit setTimeout limit (~24.8 days).
    // Chain two timers: first fires at the safe max, second fires for the remainder.
    const totalMs = ttlSeconds * 1000;
    const MAX_TIMEOUT = 2_147_483_647; // 2^31 - 1
    const cleanup = () => this.tokenRecords.delete(accessToken);
    if (totalMs <= MAX_TIMEOUT) {
      setTimeout(cleanup, totalMs).unref();
    } else {
      setTimeout(() => {
        setTimeout(cleanup, totalMs - MAX_TIMEOUT).unref();
      }, MAX_TIMEOUT).unref();
    }
  }

  async deleteTokenRecord(accessToken: string): Promise<void> {
    this.tokenRecords.delete(accessToken);
  }

  // --- Refresh index ---
  async getRefreshIndex(refreshToken: string): Promise<string | undefined> {
    return this.refreshIndex.get(refreshToken);
  }

  async setRefreshIndex(refreshToken: string, accessToken: string, ttlSeconds: number): Promise<void> {
    this.refreshIndex.set(refreshToken, accessToken);
    const totalMs = ttlSeconds * 1000;
    const MAX_TIMEOUT = 2_147_483_647;
    const cleanup = () => this.refreshIndex.delete(refreshToken);
    if (totalMs <= MAX_TIMEOUT) {
      setTimeout(cleanup, totalMs).unref();
    } else {
      setTimeout(() => {
        setTimeout(cleanup, totalMs - MAX_TIMEOUT).unref();
      }, MAX_TIMEOUT).unref();
    }
  }

  async deleteRefreshIndex(refreshToken: string): Promise<void> {
    this.refreshIndex.delete(refreshToken);
  }

  // --- Validation cache ---
  async getValidationCache(accessToken: string): Promise<number | undefined> {
    return this.validationCache.get(accessToken);
  }

  async setValidationCache(accessToken: string, epochSeconds: number, ttlSeconds: number): Promise<void> {
    this.validationCache.set(accessToken, epochSeconds);
    setTimeout(() => this.validationCache.delete(accessToken), ttlSeconds * 1000).unref();
  }

  async deleteValidationCache(accessToken: string): Promise<void> {
    this.validationCache.delete(accessToken);
  }

  // --- Lifecycle ---
  async ping(): Promise<void> {
    // No-op for in-memory store
  }

  async disconnect(): Promise<void> {
    // No-op for in-memory store
  }
}
