/* Phase 94 — pushPrune unit tests (prune policy). */

import { describe, expect, it } from "vitest";
import { classifyPushSendError } from "./pushPrune";

describe("classifyPushSendError (mirrored in the send-push edge function)", () => {
  it("404 and 410 → prune (dead subscription, DELETE the row)", () => {
    expect(classifyPushSendError(404)).toBe("prune");
    expect(classifyPushSendError(410)).toBe("prune");
  });

  it("429 and 5xx → retryable (transient, keep the row)", () => {
    expect(classifyPushSendError(429)).toBe("retryable");
    expect(classifyPushSendError(500)).toBe("retryable");
    expect(classifyPushSendError(503)).toBe("retryable");
  });

  it("other 4xx → failed (request problem, keep the row, log it)", () => {
    expect(classifyPushSendError(400)).toBe("failed");
    expect(classifyPushSendError(401)).toBe("failed");
    expect(classifyPushSendError(413)).toBe("failed");
  });

  it("missing status (network failure) → retryable", () => {
    expect(classifyPushSendError(undefined)).toBe("retryable");
  });

  it("never prunes on anything but 404/410", () => {
    for (const code of [200, 201, 400, 401, 403, 408, 429, 500, 502]) {
      expect(classifyPushSendError(code)).not.toBe("prune");
    }
  });
});
