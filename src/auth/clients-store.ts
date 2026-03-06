import crypto from "node:crypto";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { CLIENT_SECRET_TTL_SECONDS } from "../constants.js";

/**
 * In-memory OAuth client store supporting Dynamic Client Registration (RFC 7591).
 *
 * For single-instance deployments (ECS). Migrate to Redis/DynamoDB for multi-instance.
 */
export class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>();

  constructor() {
    // Periodically evict expired clients to prevent unbounded memory growth
    setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      for (const [id, client] of this.clients) {
        if (client.client_secret_expires_at && client.client_secret_expires_at < now) {
          this.clients.delete(id);
        }
      }
    }, CLIENT_SECRET_TTL_SECONDS * 1000 / 10).unref(); // Run ~every 9 days
  }

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    const client = this.clients.get(clientId);
    if (!client) return undefined;

    // Check secret expiration
    if (client.client_secret_expires_at && client.client_secret_expires_at < Math.floor(Date.now() / 1000)) {
      this.clients.delete(clientId);
      return undefined;
    }

    return client;
  }

  registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
  ): OAuthClientInformationFull {
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

    this.clients.set(clientId, registered);
    return registered;
  }
}
