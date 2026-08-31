import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveDraft,
  saveDraftNow,
  loadDraft,
  clearDraft,
  draftIsNewer,
  formatDraftTime,
} from "./draftStore";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("draftStore", () => {
  it("save/load round-trips data with a timestamp", () => {
    saveDraftNow("k1", { a: 1 });
    const d = loadDraft<{ a: number }>("k1");
    expect(d?.data).toEqual({ a: 1 });
    expect(typeof d?.savedAt).toBe("number");
  });

  it("debounced saves coalesce rapid edits into the latest value", () => {
    saveDraft("k2", { v: 1 });
    saveDraft("k2", { v: 2 });
    vi.advanceTimersByTime(500);
    saveDraft("k2", { v: 3 });
    vi.advanceTimersByTime(500);
    expect(loadDraft("k2")).toBeNull(); // still inside the debounce window
    vi.advanceTimersByTime(600);
    expect(loadDraft<{ v: number }>("k2")?.data).toEqual({ v: 3 });
  });

  it("clearDraft removes the draft AND cancels a pending write", () => {
    saveDraft("k3", { v: 1 });
    clearDraft("k3");
    vi.advanceTimersByTime(2000);
    expect(loadDraft("k3")).toBeNull();
  });

  it("keys are namespaced per entity", () => {
    saveDraftNow("workout-draft-aaa", { sets: 2 });
    saveDraftNow("workout-draft-bbb", { sets: 5 });
    expect(loadDraft<{ sets: number }>("workout-draft-aaa")?.data.sets).toBe(2);
    expect(loadDraft<{ sets: number }>("workout-draft-bbb")?.data.sets).toBe(5);
  });

  it("draftIsNewer compares against the entity timestamp", () => {
    const d = { data: {}, savedAt: 1000 };
    expect(draftIsNewer(d, null)).toBe(true);
    expect(draftIsNewer(d, 500)).toBe(true);
    expect(draftIsNewer(d, 1500)).toBe(false);
  });

  it("corrupt payloads read as no draft", () => {
    localStorage.setItem("azfit-draft:bad", "{not json");
    expect(loadDraft("bad")).toBeNull();
    localStorage.setItem("azfit-draft:bad2", JSON.stringify({ nope: 1 }));
    expect(loadDraft("bad2")).toBeNull();
  });

  it("formatDraftTime shows time today, date+time otherwise", () => {
    const now = new Date("2026-08-31T15:00:00").getTime();
    expect(formatDraftTime(new Date("2026-08-31T09:32:00").getTime(), now)).toMatch(/09:32/);
    expect(formatDraftTime(new Date("2026-08-29T09:32:00").getTime(), now)).toMatch(/Aug 29/);
  });
});
