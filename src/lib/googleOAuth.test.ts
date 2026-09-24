import { describe, expect, it, vi } from "vitest";
import {
  resolveGoogleAuthMode,
  refreshGoogleAccessToken,
} from "./googleOAuth";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("resolveGoogleAuthMode", () => {
  it("returns legacy_sa when the refresh token is absent", () => {
    expect(resolveGoogleAuthMode({})).toEqual({ mode: "legacy_sa" });
  });

  it("returns legacy_sa when the refresh token is empty or whitespace", () => {
    expect(
      resolveGoogleAuthMode({ GOOGLE_OAUTH_REFRESH_TOKEN: "" }),
    ).toEqual({ mode: "legacy_sa" });
    expect(
      resolveGoogleAuthMode({ GOOGLE_OAUTH_REFRESH_TOKEN: "   " }),
    ).toEqual({ mode: "legacy_sa" });
  });

  it("returns oauth when all three secrets are present", () => {
    const env = {
      GOOGLE_OAUTH_REFRESH_TOKEN: "rt-123",
      GOOGLE_OAUTH_CLIENT_ID: "cid.apps.googleusercontent.com",
      GOOGLE_OAUTH_CLIENT_SECRET: "cs-456",
    };
    expect(resolveGoogleAuthMode(env)).toEqual({
      mode: "oauth",
      refreshToken: "rt-123",
      clientId: "cid.apps.googleusercontent.com",
      clientSecret: "cs-456",
    });
  });

  it("returns incomplete when the refresh token is set but client_id is missing", () => {
    expect(
      resolveGoogleAuthMode({
        GOOGLE_OAUTH_REFRESH_TOKEN: "rt-123",
        GOOGLE_OAUTH_CLIENT_SECRET: "cs-456",
      }),
    ).toEqual({ mode: "incomplete" });
  });

  it("returns incomplete when the refresh token is set but client_secret is missing", () => {
    expect(
      resolveGoogleAuthMode({
        GOOGLE_OAUTH_REFRESH_TOKEN: "rt-123",
        GOOGLE_OAUTH_CLIENT_ID: "cid",
      }),
    ).toEqual({ mode: "incomplete" });
  });
});

describe("refreshGoogleAccessToken", () => {
  const cfg = {
    refreshToken: "rt-123",
    clientId: "cid",
    clientSecret: "cs-456",
  };

  it("sends the refresh grant form and returns the access token", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ access_token: "ya29.access", expires_in: 3599 }),
    );
    const token = await refreshGoogleAccessToken(cfg, fetchImpl as unknown as typeof fetch);
    expect(token).toBe("ya29.access");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt-123");
    expect(body.get("client_id")).toBe("cid");
    expect(body.get("client_secret")).toBe("cs-456");
  });

  it("Google 400 on a bad refresh token → sanitized error, no token echo", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: "invalid_grant", error_description: "Token revoked: rt-123" },
        400,
      ),
    );
    await expect(
      refreshGoogleAccessToken(cfg, fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow("Google OAuth refresh failed (status 400)");
    await expect(
      refreshGoogleAccessToken(cfg, fetchImpl as unknown as typeof fetch),
    ).rejects.not.toThrow("rt-123");
  });

  it("missing access_token in a 200 body → honest error", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ expires_in: 3599 }));
    await expect(
      refreshGoogleAccessToken(cfg, fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow("returned no access token");
  });
});
