import { describe, it, expect } from "vitest";
import { sanitizeEmojiInput, isCompleteDay, completionEmojiFor, EMOJI_PRESETS, DEFAULT_COMPLETION_EMOJI } from "./scheduleEmoji";

describe("sanitizeEmojiInput — single emoji grapheme or empty", () => {
  it("accepts all presets and strips everything else", () => {
    for (const e of EMOJI_PRESETS) expect(sanitizeEmojiInput(e)).toBe(e);
    expect(sanitizeEmojiInput(DEFAULT_COMPLETION_EMOJI)).toBe("🔥");
  });

  it("rejects text, multiple graphemes, and mixed input", () => {
    expect(sanitizeEmojiInput("fire")).toBe("");
    expect(sanitizeEmojiInput("🔥🔥")).toBe("");
    expect(sanitizeEmojiInput("🔥fire")).toBe("");
    expect(sanitizeEmojiInput("a")).toBe("");
    expect(sanitizeEmojiInput("")).toBe("");
    expect(sanitizeEmojiInput("   ")).toBe("");
  });

  it("accepts single non-preset emoji (native keyboard input)", () => {
    expect(sanitizeEmojiInput("🎉")).toBe("🎉");
    expect(sanitizeEmojiInput("💯")).toBe("💯");
  });
});

describe("completion derivation — honest, real statuses only", () => {
  it("complete only when ALL scheduled sessions are completed", () => {
    expect(isCompleteDay(["completed"])).toBe(true);
    expect(isCompleteDay(["completed", "completed"])).toBe(true);
    expect(isCompleteDay(["completed", "scheduled"])).toBe(false);
    expect(isCompleteDay(["scheduled"])).toBe(false);
    expect(isCompleteDay([])).toBe(false); // no sessions → no marker
  });

  it("marker only on complete days, never with 'None'", () => {
    expect(completionEmojiFor(["completed"], "🔥")).toBe("🔥");
    expect(completionEmojiFor(["scheduled"], "🔥")).toBeNull();
    expect(completionEmojiFor([], "🔥")).toBeNull();
    expect(completionEmojiFor(["completed"], "")).toBeNull(); // user chose None
  });
});
