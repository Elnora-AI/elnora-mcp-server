import crypto from "node:crypto";
import { Redis } from "ioredis";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { CLIENT_SECRET_TTL_SECONDS } from "../constants.js";

const PREFIX_CLIENT = "elnora:mcp:client:";

/**
 * Redis-backed OAuth client store supporting Dynamic Client Registration (RFC 7591).
 *
 * Persists client registrations across server restarts via Redis.
 * Key layout: elnora:mcp:client:{clientId} → JSON OAuthClientInformationFull (90-day TTL)
 */
export class RedisClientsStore implements OAuthRegisteredClientsStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 100, 5000);
      },
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const data = await this.redis.get(`${PREFIX_CLIENT}${clientId}`);
    return data ? JSON.parse(data) : undefined;
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
  ): Promise<OAuthClientInformationFull> {
    // Validate redirect_uri schemes — HTTPS required, HTTP only for localhost (CoSAI MCP-T7)
    if (client.redirect_uris) {
      for (const uri of client.redirect_uris) {
        let parsed: URL;
        try {
          parsed = new URL(uri);
        } catch {
          throw new Error(`Invalid redirect_uri: ${uri}`);
        }
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          throw new Error(`redirect_uri must use HTTPS (got ${parsed.protocol}): ${uri}`);
        }
        if (parsed.protocol === "http:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
          throw new Error(`HTTP redirect_uri only allowed for localhost: ${uri}`);
        }
      }
    }

    const clientId = crypto.randomUUID();
    const clientSecret = crypto.randomBytes(32).toString("base64url");
    const now = Math.floor(Date.now() / 1000);

    const registered: OAuthClientInformationFull = {
      ...client,
      client_id: clientId,
      client_id_issued_at: now,
      client_secret: clientSecret,
      client_secret_expires_at: now + CLIENT_SECRET_TTL_SECONDS,
    };

    await this.redis.set(
      `${PREFIX_CLIENT}${clientId}`,
      JSON.stringify(registered),
      "EX",
      CLIENT_SECRET_TTL_SECONDS,
    );

    return registered;
  }

  async ping(): Promise<void> {
    const result = await this.redis.ping();
    if (result !== "PONG") {
      throw new Error(`Redis ping failed: ${result}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
