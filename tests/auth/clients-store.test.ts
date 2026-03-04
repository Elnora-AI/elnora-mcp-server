import { describe, it, expect } from "vitest";
import { InMemoryClientsStore } from "../../src/auth/clients-store.js";

describe("InMemoryClientsStore", () => {
  it("returns undefined for unregistered client", () => {
    const store = new InMemoryClientsStore();
    expect(store.getClient("nonexistent")).toBeUndefined();
  });

  it("registers a client and returns it with generated id and secret", () => {
    const store = new InMemoryClientsStore();
    const registered = store.registerClient({
      redirect_uris: ["http://localhost:3000/callback"],
      token_endpoint_auth_method: "client_secret_post",
    });

    expect(registered.client_id).toBeDefined();
    expect(registered.client_secret).toBeDefined();
    expect(registered.client_id_issued_at).toBeGreaterThan(0);
    expect(registered.client_secret_expires_at).toBeGreaterThan(registered.client_id_issued_at!);
    expect(registered.redirect_uris).toEqual(["http://localhost:3000/callback"]);
  });

  it("retrieves a registered client by ID", () => {
    const store = new InMemoryClientsStore();
    const registered = store.registerClient({
      redirect_uris: ["http://localhost:3000/callback"],
    });

    const retrieved = store.getClient(registered.client_id);
    expect(retrieved).toEqual(registered);
  });

  it("returns undefined for expired client secret", () => {
    const store = new InMemoryClientsStore();
    const registered = store.registerClient({
      redirect_uris: ["http://localhost:3000/callback"],
    });

    // Manually expire the secret
    (registered as Record<string, unknown>).client_secret_expires_at = Math.floor(Date.now() / 1000) - 1;

    const retrieved = store.getClient(registered.client_id);
    expect(retrieved).toBeUndefined();
  });

  it("generates unique IDs for each registered client", () => {
    const store = new InMemoryClientsStore();
    const client1 = store.registerClient({ redirect_uris: ["http://localhost:3001/callback"] });
    const client2 = store.registerClient({ redirect_uris: ["http://localhost:3002/callback"] });

    expect(client1.client_id).not.toBe(client2.client_id);
    expect(client1.client_secret).not.toBe(client2.client_secret);
  });
});
