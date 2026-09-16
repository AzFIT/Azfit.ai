// Phase 97b — unit tests for src/lib/aiGenerate.ts.
import { describe, it, expect } from "vitest";
import {
  buildGenerationPrompt,
  contextLines,
  hasAnyContext,
  OUTPUT_FORMAT_INSTRUCTION,
} from "./aiGenerate";
import { GBC_DAY_PROMPT } from "./promptTemplates";

const CTX = {
  goal: "fat loss",
  experience: "beginner",
  equipment: ["Barbell", "Dumbbell", "Cable"],
  notes: "tight left shoulder",
};

describe("contextLines — client fields injected, missing omitted", () => {
  it("emits one line per provided field", () => {
    expect(contextLines(CTX)).toEqual([
      "- Goal/Focus: fat loss",
      "- Level: beginner",
      "- Equipment: Barbell, Dumbbell, Cable",
      "- Injuries/Limitations/Notes: tight left shoulder",
    ]);
  });

  it("omits null/empty fields — never faked", () => {
    expect(contextLines({ goal: null, experience: "", equipment: [], notes: undefined })).toEqual([]);
    expect(contextLines({ goal: "muscle gain" })).toEqual(["- Goal/Focus: muscle gain"]);
  });

  it("drops empty strings inside the equipment array", () => {
    expect(contextLines({ equipment: ["Bands", "", "Kettlebell"] })).toEqual([
      "- Equipment: Bands, Kettlebell",
    ]);
  });
});

describe("hasAnyContext", () => {
  it("true with any real field, false with none", () => {
    expect(hasAnyContext(CTX)).toBe(true);
    expect(hasAnyContext({})).toBe(false);
  });
});

describe("buildGenerationPrompt", () => {
  it("includes the template VERBATIM", () => {
    const prompt = buildGenerationPrompt(GBC_DAY_PROMPT, CTX);
    expect(prompt.startsWith(GBC_DAY_PROMPT)).toBe(true);
  });

  it("marks the context block as from the client profile", () => {
    const prompt = buildGenerationPrompt(GBC_DAY_PROMPT, CTX);
    expect(prompt).toContain("Client context (from client profile):");
    expect(prompt).toContain("- Goal/Focus: fat loss");
    expect(prompt).toContain("- Equipment: Barbell, Dumbbell, Cable");
    expect(prompt).toContain("- Injuries/Limitations/Notes: tight left shoulder");
  });

  it("omits the context block entirely when nothing is known", () => {
    const prompt = buildGenerationPrompt(GBC_DAY_PROMPT, {});
    expect(prompt).not.toContain("Client context (from client profile):");
    expect(prompt.startsWith(GBC_DAY_PROMPT)).toBe(true);
  });

  it("ends with the Phase 93 output-format instruction", () => {
    const prompt = buildGenerationPrompt(GBC_DAY_PROMPT, CTX);
    expect(prompt.endsWith(OUTPUT_FORMAT_INSTRUCTION)).toBe(true);
    expect(prompt).toContain("| Day | Order | Exercise | Sets | Reps | Tempo | Rest |");
  });
});
