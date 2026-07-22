import { describe, it, expect } from "vitest";
import { normalizeOFFProduct } from "@/lib/foodApi";

const realisticOFF = {
  code: "3017620422003",
  product_name: "Nutella",
  brands: "Ferrero",
  categories: "Spreads, Sweet spreads, Hazelnut spreads",
  nutriments: {
    "energy-kcal_100g": 539,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9,
  },
};

describe("normalizeOFFProduct", () => {
  it("maps a realistic OFF product to foods_cache shape", () => {
    const row = normalizeOFFProduct(realisticOFF);
    expect(row).not.toBeNull();
    expect(row?.source).toBe("off");
    expect(row?.source_id).toBe("3017620422003");
    expect(row?.name).toBe("Nutella");
    expect(row?.brand).toBe("Ferrero");
    expect(row?.category).toBe("Spreads");
    expect(row?.serving_size_g).toBe(100);
    expect(row?.calories).toBe(539);
    expect(row?.protein).toBe(6.3);
    expect(row?.carbs).toBe(57.5);
    expect(row?.fats).toBe(30.9);
    expect(row?.raw).toEqual(realisticOFF);
  });

  it("defaults missing nutriments to 0", () => {
    const row = normalizeOFFProduct({
      code: "123",
      product_name: "Mystery Food",
      nutriments: { "energy-kcal_100g": 100 },
    });
    expect(row).not.toBeNull();
    expect(row?.protein).toBe(0);
    expect(row?.carbs).toBe(0);
    expect(row?.fats).toBe(0);
    expect(row?.brand).toBeNull();
    expect(row?.category).toBeNull();
  });

  it("skips products with no name", () => {
    const row = normalizeOFFProduct({
      code: "123",
      product_name: "",
      nutriments: { "energy-kcal_100g": 100 },
    });
    expect(row).toBeNull();
  });

  it("skips products with no kcal", () => {
    const row = normalizeOFFProduct({
      code: "123",
      product_name: "No Calories",
      nutriments: {},
    });
    expect(row).toBeNull();
  });

  it("falls back to energy-kcal when energy-kcal_100g missing", () => {
    const row = normalizeOFFProduct({
      code: "123",
      product_name: "Fallback",
      nutriments: { "energy-kcal": 250 },
    });
    expect(row).not.toBeNull();
    expect(row?.calories).toBe(250);
  });
});
