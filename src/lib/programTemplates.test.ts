import { describe, it, expect } from "vitest";
import {
  parseTemplateTags,
  humanizeTag,
  templateTagLabels,
  mapTemplateNameToId,
  bestMappedId,
  TEMPLATE_GOAL_MAP,
  TEMPLATE_METHOD_MAP,
} from "@/lib/programTemplates";

describe("parseTemplateTags", () => {
  it("splits hashtags, strips '#', drops empties", () => {
    expect(parseTemplateTags("#fat-loss #supersets #metabolic")).toEqual([
      "fat-loss",
      "supersets",
      "metabolic",
    ]);
  });

  it("handles null/empty/extra whitespace", () => {
    expect(parseTemplateTags(null)).toEqual([]);
    expect(parseTemplateTags("")).toEqual([]);
    expect(parseTemplateTags("  #a   #b  ")).toEqual(["a", "b"]);
  });
});

describe("humanizeTag / templateTagLabels", () => {
  it("hyphens to title-cased words", () => {
    expect(humanizeTag("fat-loss")).toBe("Fat Loss");
    expect(humanizeTag("supersets")).toBe("Supersets");
    expect(humanizeTag("5-6-days")).toBe("5 6 Days");
  });

  it("parse + humanize together", () => {
    expect(templateTagLabels("#fat-loss #muscle-gain")).toEqual(["Fat Loss", "Muscle Gain"]);
  });
});

describe("goal/method name → wizard id mapping", () => {
  it("maps goals-table names to wizard GOALS ids", () => {
    expect(mapTemplateNameToId("Hypertrophy", TEMPLATE_GOAL_MAP)).toBe("hypertrophy");
    expect(mapTemplateNameToId("Fat Loss", TEMPLATE_GOAL_MAP)).toBe("fatloss");
    expect(mapTemplateNameToId("Body Recomposition", TEMPLATE_GOAL_MAP)).toBe("fatloss");
    expect(mapTemplateNameToId("Conditioning", TEMPLATE_GOAL_MAP)).toBe("endurance");
    expect(mapTemplateNameToId("Strength", TEMPLATE_GOAL_MAP)).toBe("strength");
  });

  it("maps methods-table names to wizard METHODS ids", () => {
    expect(mapTemplateNameToId("German Volume Training", TEMPLATE_METHOD_MAP)).toBe("german-volume");
    expect(mapTemplateNameToId("5x5 Stronglifts", TEMPLATE_METHOD_MAP)).toBe("5x5");
    expect(mapTemplateNameToId("HIIT", TEMPLATE_METHOD_MAP)).toBe("hiit");
    expect(mapTemplateNameToId("Circuit Conditioning", TEMPLATE_METHOD_MAP)).toBe("hiit");
    expect(mapTemplateNameToId("Triphasic Training", TEMPLATE_METHOD_MAP)).toBe("triphasic");
  });

  it("returns null for unmappable names", () => {
    expect(mapTemplateNameToId("Olympic Weightlifting", TEMPLATE_METHOD_MAP)).toBeNull();
    expect(mapTemplateNameToId("Flexibility", TEMPLATE_GOAL_MAP)).toBeNull();
  });

  it("bestMappedId picks the first mappable scored row in order", () => {
    const scored = [
      { name: "Circuit Conditioning", score: 45.85 }, // maps (hiit)
      { name: "HIIT", score: 45.85 },
      { name: "Interval Training", score: 45.85 },
    ];
    expect(bestMappedId(scored, TEMPLATE_METHOD_MAP)).toBe("hiit");
    expect(bestMappedId([{ name: "Unmappable", score: 99 }], TEMPLATE_METHOD_MAP)).toBeNull();
  });
});
