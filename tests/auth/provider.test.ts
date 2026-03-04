import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElnoraOAuthProvider } from "../../src/auth/provider.js";
import type { ElnoraConfig } from "../../src/types.js";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    isAxiosError: (e: unknown) => e instanceof Error && "response" in (e as Record<string, unknown>),
  },
}));

import axios from "axios";

const config: ElnoraConfig = {
  apiUrl: "https://api.example.com",
  authUrl: "https://auth.example.com",
  tokenValidationUrl: "https://api.example.com/auth/validate-token",
  port: 3001,
  publicUrl: "https://mcp.example.com",
  loginUrl: "https://platform.example.com/login",
  tokenExchangeUrl: "https://api.example.com/oauth/token",
  platformClientId: "mcp-server",
  platformClientSecret: "secret",
};

describe("ElnoraOAuthProvider", () => {
  let provider: ElnoraOAuthProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ElnoraOAuthProvider(config);
  });

  describe("clientsStore", () => {
    it("exposes a clients store that supports registration", () => {
      const store = provider.clientsStore;
      expect(store).toBeDefined();
      expect(store.registerClient).toBeDefined();
    });
  });

  describe("authorize", () => {
    it("redirects to the platform login URL with mcp_code", async () => {
      const client = {
        client_id: "test-client",
        redirect_uris: ["http://localhost:3000/callback"],
      };
      const params = {
        codeChallenge: "test-challenge",
        redirectUri: "http://localhost:3000/callback",
        scopes: ["tasks:read"],
        state: "test-state",
      };
      const redirectFn = vi.fn();
      const res = { redirect: redirectFn } as never;

      await provider.authorize(client, params, res);

      expect(redirectFn).toHaveBeenCalledTimes(1);
      const redirectUrl = new URL(redirectFn.mock.calls[0][0]);
      expect(redirectUrl.origin).toBe("https://platform.example.com");
      expect(redirectUrl.pathname).toBe("/login");
      expect(redirectUrl.searchParams.get("mcp_code")).toBeDefined();
      expect(redirectUrl.searchParams.get("redirect_uri")).toBe("https://mcp.example.com/oauth/callback");
      expect(redirectUrl.searchParams.get("client_id")).toBe("mcp-server");
    });
  });

  describe("challengeForAuthorizationCode", () => {
    it("returns the stored code challenge after authorize", async () => {
      const client = { client_id: "test-client", redirect_uris: ["http://localhost:3000/callback"] };
      const params = {
        codeChallenge: "my-challenge-value",
        redirectUri: "http://localhost:3000/callback",
      };
      const redirectFn = vi.fn();
      const res = { redirect: redirectFn } as never;

      await provider.authorize(client, params, res);
      const redirectUrl = new URL(redirectFn.mock.calls[0][0]);
      const mcpCode = redirectUrl.searchParams.get("mcp_code")!;

      const challenge = await provider.challengeForAuthorizationCode(client, mcpCode);
      expect(challenge).toBe("my-challenge-value");
    });

    it("throws for invalid authorization code", async () => {
      const client = { client_id: "test-client", redirect_uris: [] };
      await expect(provider.challengeForAuthorizationCode(client, "invalid")).rejects.toThrow(
        "Invalid or expired authorization code",
      );
    });
  });

  describe("exchangeAuthorizationCode", () => {
    it("exchanges code for tokens via platform and issues MCP tokens", async () => {
      const client = { client_id: "test-client", redirect_uris: ["http://localhost:3000/callback"] };
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

      // Simulate platform callback
      provider.handlePlatformCallback(mcpCode, "platform-auth-code");

      // Mock platform token exchange
      vi.mocked(axios.post).mockResolvedValueOnce({
        data: { access_token: "platform-token-123" },
      });

      const tokens = await provider.exchangeAuthorizationCode(client, mcpCode);

      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.token_type).toBe("Bearer");
      expect(tokens.expires_in).toBe(3600);
    });

    it("throws for invalid authorization code", async () => {
      const client = { client_id: "test-client", redirect_uris: [] };
      await expect(provider.exchangeAuthorizationCode(client, "invalid")).rejects.toThrow(
        "Invalid or expired authorization code",
      );
    });

    it("throws when client_id doesn't match", async () => {
      const client1 = { client_id: "client-1", redirect_uris: ["http://localhost:3000/callback"] };
      const client2 = { client_id: "client-2", redirect_uris: [] };
      const params = {
        codeChallenge: "challenge",
        redirectUri: "http://localhost:3000/callback",
      };
      const redirectFn = vi.fn();
      const res = { redirect: redirectFn } as never;

      await provider.authorize(client1, params, res);
      const redirectUrl = new URL(redirectFn.mock.calls[0][0]);
      const mcpCode = redirectUrl.searchParams.get("mcp_code")!;

      await expect(provider.exchangeAuthorizationCode(client2, mcpCode)).rejects.toThrow(
        "Authorization code was not issued to this client",
      );
    });
  });

  describe("verifyAccessToken", () => {
    it("throws for unknown token", async () => {
      await expect(provider.verifyAccessToken("unknown-token")).rejects.toThrow("Invalid access token");
    });
  });

  describe("revokeToken", () => {
    it("does not throw for unknown token (idempotent)", async () => {
      const client = { client_id: "test-client", redirect_uris: [] };
      await expect(
        provider.revokeToken(client, { token: "unknown", token_type_hint: "access_token" }),
      ).resolves.not.toThrow();
    });
  });

  describe("handlePlatformCallback", () => {
    it("throws for invalid mcp_code", () => {
      expect(() => provider.handlePlatformCallback("invalid", "platform-code")).toThrow(
        "Invalid or expired MCP authorization code",
      );
    });
  });

  describe("getClientRedirectUrl", () => {
    it("builds redirect URL with code and state", async () => {
      const client = { client_id: "test-client", redirect_uris: ["http://localhost:3000/callback"] };
      const params = {
        codeChallenge: "challenge",
        redirectUri: "http://localhost:3000/callback",
        state: "my-state",
      };
      const redirectFn = vi.fn();
      const res = { redirect: redirectFn } as never;

      await provider.authorize(client, params, res);
      const loginUrl = new URL(redirectFn.mock.calls[0][0]);
      const mcpCode = loginUrl.searchParams.get("mcp_code")!;

      provider.handlePlatformCallback(mcpCode, "platform-code");
      const redirectUrl = provider.getClientRedirectUrl(mcpCode);
      const parsed = new URL(redirectUrl);

      expect(parsed.origin).toBe("http://localhost:3000");
      expect(parsed.pathname).toBe("/callback");
      expect(parsed.searchParams.get("code")).toBe(mcpCode);
      expect(parsed.searchParams.get("state")).toBe("my-state");
    });
  });
});
