import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElnoraOAuthProvider } from "../../src/auth/provider.js";
import type { ElnoraConfig } from "../../src/types.js";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    isAxiosError: (e: unknown) => e instanceof Error && "isAxiosError" in (e as Record<string, unknown>) && (e as Record<string, unknown>).isAxiosError === true,
  },
}));

import axios from "axios";

const config: ElnoraConfig = {
  apiUrl: "https://api.example.com",
  tokenValidationUrl: "https://api.example.com/auth/validate-token",
  port: 3001,
  publicUrl: "https://mcp.example.com",
  loginUrl: "https://platform.example.com/login",
  tokenExchangeUrl: "https://api.example.com/oauth/token",
  platformClientId: "mcp-server",
  platformClientSecret: "secret",
};

/** Helper: run the full authorize → callback → exchange flow to get tokens */
async function issueTokens(provider: ElnoraOAuthProvider) {
  // Register client in the store so handlePlatformCallback can validate redirect_uri
  const registered = provider.clientsStore.registerClient({
    redirect_uris: ["http://localhost:3000/callback"],
  });
  const client = { client_id: registered.client_id, redirect_uris: ["http://localhost:3000/callback"] };
  const params = {
    codeChallenge: "challenge",
    redirectUri: "http://localhost:3000/callback",
    scopes: ["tasks:read"],
  };
  const redirectFn = vi.fn();
  const res = { redirect: redirectFn } as never;

  await provider.authorize(client, params, res);
  const redirectUrl = new URL(redirectFn.mock.calls[0][0]);
  const mcpCode = redirectUrl.searchParams.get("mcp_code")!;

  const platformState = redirectUrl.searchParams.get("state")!;
  provider.handlePlatformCallback(mcpCode, "platform-auth-code", platformState);

  vi.mocked(axios.post).mockResolvedValueOnce({
    data: { access_token: "platform-token-123" },
  });

  const tokens = await provider.exchangeAuthorizationCode(client, mcpCode, undefined, "http://localhost:3000/callback");
  return { tokens, client };
}

describe("ElnoraOAuthProvider — advanced flows", () => {
  let provider: ElnoraOAuthProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ElnoraOAuthProvider(config);
  });

  describe("verifyAccessToken", () => {
    it("returns AuthInfo for a valid token when platform confirms", async () => {
      const { tokens, client } = await issueTokens(provider);

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { valid: true },
      });

      const authInfo = await provider.verifyAccessToken(tokens.access_token);
      expect(authInfo.token).toBe(tokens.access_token);
      expect(authInfo.clientId).toBe(client.client_id);
      expect(authInfo.scopes).toEqual(["tasks:read"]);
      // platformToken should NOT be in AuthInfo.extra (CoSAI MCP-T1: no token passthrough)
      expect(authInfo.extra?.platformToken).toBeUndefined();
      // But it should be accessible via the dedicated method
      expect(provider.getPlatformToken(tokens.access_token)).toBe("platform-token-123");
    });

    it("revokes token when platform returns { valid: false }", async () => {
      const { tokens } = await issueTokens(provider);

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { valid: false },
      });

      await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow(
        "Underlying platform token revoked",
      );

      // Token should be deleted — second call fails with "Invalid access token"
      await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow(
        "Invalid access token",
      );
    });

    it("revokes token when platform returns 401", async () => {
      const { tokens } = await issueTokens(provider);

      const axiosError = new Error("Unauthorized") as Error & { response: { status: number } };
      (axiosError as Record<string, unknown>).response = { status: 401 };
      (axiosError as Record<string, unknown>).isAxiosError = true;
      vi.mocked(axios.post).mockRejectedValueOnce(axiosError);

      await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow(
        "Underlying platform token revoked",
      );
    });

    it("rejects on network error (fail-closed for security)", async () => {
      const { tokens } = await issueTokens(provider);

      // Network error without response property
      vi.mocked(axios.post).mockRejectedValueOnce(new Error("ECONNREFUSED"));

      // Should reject — fail-closed behavior
      await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow(
        "Platform token validation unavailable",
      );

      // Token should NOT be deleted — it's a transient failure, not revocation
      vi.mocked(axios.post).mockResolvedValueOnce({ data: { valid: true } });
      const authInfo = await provider.verifyAccessToken(tokens.access_token);
      expect(authInfo.token).toBe(tokens.access_token);
    });

    it("uses validation cache on second call (no extra platform request)", async () => {
      const { tokens } = await issueTokens(provider);

      // First call — hits platform
      vi.mocked(axios.post).mockResolvedValueOnce({ data: { valid: true } });
      await provider.verifyAccessToken(tokens.access_token);
      const callCountAfterFirst = vi.mocked(axios.post).mock.calls.length;

      // Second call — should use cache, NOT call platform again
      const authInfo = await provider.verifyAccessToken(tokens.access_token);
      expect(vi.mocked(axios.post).mock.calls.length).toBe(callCountAfterFirst);
      expect(authInfo.token).toBe(tokens.access_token);
    });

    it("throws for expired token", async () => {
      const { tokens } = await issueTokens(provider);

      // Manually expire the token by mocking Date.now
      const future = Date.now() + 4000 * 1000; // 4000 seconds in the future
      vi.spyOn(Date, "now").mockReturnValue(future);

      await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow(
        "Access token expired",
      );

      vi.restoreAllMocks();
    });
  });

  describe("exchangeRefreshToken", () => {
    it("issues new tokens and rotates the old ones", async () => {
      const { tokens, client } = await issueTokens(provider);

      // Mock platform token re-validation during refresh
      vi.mocked(axios.post).mockResolvedValueOnce({ data: { valid: true } });
      const newTokens = await provider.exchangeRefreshToken(client, tokens.refresh_token!);

      expect(newTokens.access_token).toBeDefined();
      expect(newTokens.refresh_token).toBeDefined();
      expect(newTokens.access_token).not.toBe(tokens.access_token);
      expect(newTokens.refresh_token).not.toBe(tokens.refresh_token);
      expect(newTokens.token_type).toBe("Bearer");
      expect(newTokens.expires_in).toBe(3600);
    });

    it("invalidates old refresh token after rotation", async () => {
      const { tokens, client } = await issueTokens(provider);

      vi.mocked(axios.post).mockResolvedValueOnce({ data: { valid: true } });
      await provider.exchangeRefreshToken(client, tokens.refresh_token!);

      // Old refresh token should no longer work
      await expect(
        provider.exchangeRefreshToken(client, tokens.refresh_token!),
      ).rejects.toThrow("Invalid refresh token");
    });

    it("throws for invalid refresh token", async () => {
      const client = { client_id: "test-client", redirect_uris: [] };
      await expect(
        provider.exchangeRefreshToken(client, "nonexistent-token"),
      ).rejects.toThrow("Invalid refresh token");
    });

    it("throws when client_id doesn't match", async () => {
      const { tokens } = await issueTokens(provider);
      const wrongClient = { client_id: "wrong-client", redirect_uris: [] };

      // client_id mismatch is checked before platform validation
      await expect(
        provider.exchangeRefreshToken(wrongClient, tokens.refresh_token!),
      ).rejects.toThrow("Invalid refresh token");
    });

    it("throws on scope escalation attempt", async () => {
      const { tokens, client } = await issueTokens(provider);

      // Scope escalation is checked before platform validation
      // Original grant was ["tasks:read"]. Try to escalate to ["orgs:write"].
      await expect(
        provider.exchangeRefreshToken(client, tokens.refresh_token!, ["tasks:read", "orgs:write"]),
      ).rejects.toThrow("Scope escalation not allowed");
    });

    it("allows scope downgrade on refresh", async () => {
      const { tokens, client } = await issueTokens(provider);

      vi.mocked(axios.post).mockResolvedValueOnce({ data: { valid: true } });
      // Request a subset of original scopes — should succeed
      const newTokens = await provider.exchangeRefreshToken(client, tokens.refresh_token!, ["tasks:read"]);
      expect(newTokens.access_token).toBeDefined();
    });
  });

  describe("handlePlatformCallback", () => {
    it("throws on callback replay (same code used twice)", async () => {
      const registered = provider.clientsStore.registerClient({
        redirect_uris: ["http://localhost:3000/callback"],
      });
      const client = { client_id: registered.client_id, redirect_uris: ["http://localhost:3000/callback"] };
      const params = {
        codeChallenge: "challenge",
        redirectUri: "http://localhost:3000/callback",
        scopes: ["tasks:read"],
      };
      const redirectFn = vi.fn();
      const res = { redirect: redirectFn } as never;

      await provider.authorize(client, params, res);
      const redirectUrl = new URL(redirectFn.mock.calls[0][0]);
      const mcpCode = redirectUrl.searchParams.get("mcp_code")!;
      const platformState = redirectUrl.searchParams.get("state")!;

      provider.handlePlatformCallback(mcpCode, "platform-code-1", platformState);

      expect(() => provider.handlePlatformCallback(mcpCode, "platform-code-2", platformState)).toThrow(
        "Authorization callback already processed",
      );
    });
  });

  describe("verifyAccessToken — refresh token cleanup on revocation", () => {
    it("cleans refreshTokenIndex when platform returns { valid: false }", async () => {
      const { tokens, client } = await issueTokens(provider);

      vi.mocked(axios.post).mockResolvedValueOnce({ data: { valid: false } });
      await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow(
        "Underlying platform token revoked",
      );

      // Refresh token should also be invalidated
      await expect(
        provider.exchangeRefreshToken(client, tokens.refresh_token!),
      ).rejects.toThrow("Invalid refresh token");
    });

    it("cleans refreshTokenIndex when platform returns 401", async () => {
      const { tokens, client } = await issueTokens(provider);

      const axiosError = new Error("Unauthorized") as Error & { response: { status: number } };
      (axiosError as Record<string, unknown>).response = { status: 401 };
      (axiosError as Record<string, unknown>).isAxiosError = true;
      vi.mocked(axios.post).mockRejectedValueOnce(axiosError);

      await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow(
        "Underlying platform token revoked",
      );

      // Refresh token should also be invalidated
      await expect(
        provider.exchangeRefreshToken(client, tokens.refresh_token!),
      ).rejects.toThrow("Invalid refresh token");
    });
  });

  describe("revokeToken", () => {
    it("revokes an access token and cleans up refresh index", async () => {
      const { tokens, client } = await issueTokens(provider);

      // Verify token works first
      vi.mocked(axios.post).mockResolvedValueOnce({ data: { valid: true } });
      await provider.verifyAccessToken(tokens.access_token);

      // Revoke
      await provider.revokeToken(client, { token: tokens.access_token, token_type_hint: "access_token" });

      // Token should be gone
      await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow(
        "Invalid access token",
      );
    });

    it("revokes a refresh token and cleans up token record", async () => {
      const { tokens, client } = await issueTokens(provider);

      await provider.revokeToken(client, { token: tokens.refresh_token!, token_type_hint: "refresh_token" });

      // Refresh should be gone
      await expect(
        provider.exchangeRefreshToken(client, tokens.refresh_token!),
      ).rejects.toThrow("Invalid refresh token");
    });

    it("ignores revocation for wrong client_id", async () => {
      const { tokens } = await issueTokens(provider);
      const wrongClient = { client_id: "wrong-client", redirect_uris: [] };

      // Should not throw but also not revoke
      await provider.revokeToken(wrongClient, { token: tokens.access_token, token_type_hint: "access_token" });

      // Token should still work
      vi.mocked(axios.post).mockResolvedValueOnce({ data: { valid: true } });
      const authInfo = await provider.verifyAccessToken(tokens.access_token);
      expect(authInfo.token).toBe(tokens.access_token);
    });
  });
});
