import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { handleApiError } from "../../src/services/error-handler.js";

function makeAxiosError(
  status: number,
  data?: Record<string, unknown>,
): AxiosError {
  const headers = new AxiosHeaders();
  const error = new AxiosError("Request failed", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    headers,
    config: { headers } as never,
    data: data ?? {},
  });
  return error;
}

function makeAxiosNetworkError(code: string): AxiosError {
  const error = new AxiosError("Network error");
  error.code = code;
  return error;
}

describe("handleApiError", () => {
  it("returns invalid request message for 400", () => {
    const result = handleApiError(makeAxiosError(400));
    expect(result).toContain("Invalid request");
  });

  it("returns authentication failed message for 401", () => {
    const result = handleApiError(makeAxiosError(401));
    expect(result).toContain("Authentication failed");
  });

  it("returns permission denied message for 403", () => {
    const result = handleApiError(makeAxiosError(403));
    expect(result).toContain("Permission denied");
  });

  it("returns not found message for 404", () => {
    const result = handleApiError(makeAxiosError(404));
    expect(result).toContain("not found");
  });

  it("returns rate limit message for 429", () => {
    const result = handleApiError(makeAxiosError(429));
    expect(result).toContain("Rate limit exceeded");
  });

  it("returns server error with status for 500", () => {
    const result = handleApiError(makeAxiosError(500));
    expect(result).toContain("500");
  });

  it("joins data.messages array in output", () => {
    const result = handleApiError(
      makeAxiosError(400, { messages: ["field required", "invalid format"] }),
    );
    expect(result).toContain("field required, invalid format");
  });

  it("returns timeout message for ECONNABORTED", () => {
    const result = handleApiError(makeAxiosNetworkError("ECONNABORTED"));
    expect(result).toContain("timed out");
  });

  it("returns service unavailable message for ECONNREFUSED", () => {
    const result = handleApiError(makeAxiosNetworkError("ECONNREFUSED"));
    expect(result).toContain("temporarily unavailable");
  });

  it("falls back to error.message for regular Error", () => {
    const result = handleApiError(new Error("something broke"));
    expect(result).toContain("something broke");
  });

  it("uses String() fallback for non-Error values", () => {
    const result = handleApiError("raw string error");
    expect(result).toContain("raw string error");
  });
});
