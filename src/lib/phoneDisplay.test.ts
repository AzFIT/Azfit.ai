import { describe, it, expect } from "vitest";
import { isErrorTokenPhone, displayPhone } from "@/lib/phoneDisplay";

describe("phoneDisplay (FIX-3)", () => {
  it("flags spreadsheet error tokens", () => {
    for (const v of ["#ERROR!", "#error!", "#N/A", "#REF!", "#VALUE!", "#DIV/0!", "#NAME?"]) {
      expect(isErrorTokenPhone(v)).toBe(true);
    }
  });

  it("does not flag real phones or ordinary text", () => {
    expect(isErrorTokenPhone("+1 555 010 1234")).toBe(false);
    expect(isErrorTokenPhone("555-010-1234")).toBe(false);
    expect(isErrorTokenPhone("ERROR")).toBe(false);
    expect(isErrorTokenPhone("#1 fan")).toBe(false);
    expect(isErrorTokenPhone("")).toBe(false);
    expect(isErrorTokenPhone(null)).toBe(false);
    expect(isErrorTokenPhone(undefined)).toBe(false);
  });

  it("displayPhone omits error tokens and empties, keeps real numbers", () => {
    expect(displayPhone("#ERROR!")).toBeNull();
    expect(displayPhone("  #N/A  ")).toBeNull();
    expect(displayPhone("")).toBeNull();
    expect(displayPhone(null)).toBeNull();
    expect(displayPhone("+1 555 010 1234")).toBe("+1 555 010 1234");
    expect(displayPhone("  555-010-1234  ")).toBe("555-010-1234");
  });
});
