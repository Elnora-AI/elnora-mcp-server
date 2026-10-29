import type { ElnoraConfig } from "../../src/types.js";

type PlatformResponse = { data: unknown };
type Body = Record<string, unknown>;

/** An axios-style error carrying an HTTP response, as axios throws for a non-2xx status. */
export function httpError(status: number, data: unknown = {}): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  });
}

/** An axios-style error with no response (connection failure or timeout). */
export function networkError(code = "ECONNRESET"): Error {
  return Object.assign(new Error(code), { isAxiosError: true, code });
}

/** The platform's answer for a refresh token it does not accept. */
export function rejectedRefresh(description: string): Error {
  return httpError(400, { error: "invalid_grant", error_description: description });
}

/**
 * Stateful stand-in for the platform's token endpoints. Like the real platform, refresh tokens are
 * single-use: a successful refresh consumes the presented token and returns a new pair, and a consumed
 * token is refused afterwards. Wire it in with `axios.post.mockImplementation(platform.post)`.
 */
export class FakePlatform {
  readonly calls: Array<{ url: string; body: Body; options: unknown }> = [];
  private readonly liveRefreshTokens = new Set<string>();
  private readonly usedRefreshTokens = new Set<string>();
  private readonly validAccessTokens = new Set<string>();
  private readonly interceptors: Array<(proceed: () => Promise<PlatformResponse>) => Promise<PlatformResponse>> = [];
  private sequence = 0;

  constructor(private readonly config: ElnoraConfig) {}

  /**
   * Handle the next platform call with `handler` instead of the normal behaviour. The handler may throw
   * before calling `proceed` (the platform never saw the request) or after it (the platform completed the
   * request but the response was lost).
   */
  intercept(handler: (proceed: () => Promise<PlatformResponse>) => Promise<PlatformResponse>): void {
    this.interceptors.push(handler);
  }

  /** Answer the next platform call with an error, without the platform acting on it. */
  failNext(error: Error): void {
    this.intercept(async () => {
      throw error;
    });
  }

  /** Make every access token issued so far invalid, as when they expire. */
  expireAccessTokens(): void {
    this.validAccessTokens.clear();
  }

  /** Refuse every refresh token issued so far, as when the platform ends the user's sessions. */
  endSessions(): void {
    this.liveRefreshTokens.clear();
  }

  /** Refresh tokens presented to the token endpoint, in order. */
  presentedRefreshTokens(): string[] {
    return this.calls.filter((c) => c.body.grant_type === "refresh_token").map((c) => c.body.refresh_token as string);
  }

  post = async (url: string, body: Body, options?: unknown): Promise<PlatformResponse> => {
    await Promise.resolve(); // let concurrent callers interleave, as real network calls do
    this.calls.push({ url, body, options });
    const handle = () => this.handle(url, body);
    const interceptor = this.interceptors.shift();
    return interceptor ? interceptor(handle) : handle();
  };

  private async handle(url: string, body: Body): Promise<PlatformResponse> {
    if (url === this.config.tokenValidationUrl) {
      return { data: { valid: this.validAccessTokens.has(body.token as string) } };
    }
    if (url !== this.config.tokenExchangeUrl) {
      throw new Error(`unexpected platform call: ${url}`);
    }
    if (body.grant_type === "authorization_code") {
      return { data: this.issuePair() };
    }
    const presented = body.refresh_token as string;
    if (this.usedRefreshTokens.has(presented)) throw rejectedRefresh("Refresh token has been revoked.");
    if (!this.liveRefreshTokens.has(presented)) throw rejectedRefresh("Invalid refresh token.");
    this.liveRefreshTokens.delete(presented);
    this.usedRefreshTokens.add(presented);
    return { data: this.issuePair() };
  }

  private issuePair() {
    this.sequence += 1;
    const pair = {
      access_token: `platform-access-${this.sequence}`,
      refresh_token: `platform-refresh-${this.sequence}`,
      token_type: "bearer",
      expires_in: 3600,
    };
    this.liveRefreshTokens.add(pair.refresh_token);
    this.validAccessTokens.add(pair.access_token);
    return pair;
  }
}
