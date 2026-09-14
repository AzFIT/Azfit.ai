import { describe, it, expect } from "vitest";
import {
  parseTrainerProfile,
  isProfileSetUp,
  deriveInitials,
  waMeLink,
  qrContactTarget,
  defaultTrainerProfile,
  type TrainerContact,
} from "./trainerProfile";

const contact = (over: Partial<TrainerContact> = {}): TrainerContact => ({
  whatsapp: null,
  email: null,
  instagram: null,
  website: null,
  ...over,
});

describe("parseTrainerProfile", () => {
  it("null → null", () => {
    expect(parseTrainerProfile(null)).toBeNull();
  });

  it("non-object garbage → null", () => {
    expect(parseTrainerProfile("nope")).toBeNull();
    expect(parseTrainerProfile(42)).toBeNull();
    expect(parseTrainerProfile(["a"])).toBeNull();
    expect(parseTrainerProfile(true)).toBeNull();
  });

  it("partial object → defaults filled", () => {
    const p = parseTrainerProfile({ display_name: "Alex", title: "Strength Coach" });
    expect(p).not.toBeNull();
    expect(p!.display_name).toBe("Alex");
    expect(p!.title).toBe("Strength Coach");
    expect(p!.years_experience).toBeNull();
    expect(p!.qualifications).toEqual([]);
    expect(p!.specialties).toEqual([]);
    expect(p!.languages).toEqual([]);
    expect(p!.affiliations).toEqual([]);
    expect(p!.philosophy).toEqual({ approach: null, mission: null, values: null });
    expect(p!.contact).toEqual({ whatsapp: null, email: null, instagram: null, website: null });
    expect(p!.photo_path).toBeNull();
    expect(p!.photo_variant).toBe("initials");
    expect(p!.background_path).toBeNull();
    expect(p!.gallery).toEqual([]);
  });

  it("unknown photo_variant → 'initials'", () => {
    expect(parseTrainerProfile({ photo_variant: "hologram" })!.photo_variant).toBe("initials");
    expect(parseTrainerProfile({ photo_variant: "blur" })!.photo_variant).toBe("blur");
  });

  it("coerces wrong types and drops malformed array entries", () => {
    const p = parseTrainerProfile({
      display_name: 42,
      years_experience: "ten",
      specialties: ["Strength", 7, "", "Strength", "  "],
      qualifications: [
        { name: "CSCS", issuer: "NSCA", year: 2019 },
        "garbage",
        { name: null, issuer: null, year: null },
        { name: "BS Kinesiology", issuer: 42, year: "2015" },
      ],
      gallery: [{ path: "u/p/a.jpg", caption: 5 }, { caption: "no path" }, "garbage"],
    })!;
    expect(p.display_name).toBe("");
    expect(p.years_experience).toBeNull();
    expect(p.specialties).toEqual(["Strength"]);
    expect(p.qualifications).toEqual([
      { name: "CSCS", issuer: "NSCA", year: 2019 },
      { name: "BS Kinesiology", issuer: null, year: null },
    ]);
    expect(p.gallery).toEqual([{ path: "u/p/a.jpg", caption: null }]);
  });

  it("empty strings normalize to null in nullable fields", () => {
    const p = parseTrainerProfile({
      contact: { whatsapp: "", email: "  ", instagram: "@coach", website: "https://x.com" },
      philosophy: { approach: "", mission: "M", values: null },
    })!;
    expect(p.contact.whatsapp).toBeNull();
    expect(p.contact.email).toBeNull();
    expect(p.contact.instagram).toBe("@coach");
    expect(p.philosophy).toEqual({ approach: null, mission: "M", values: null });
  });

  it("isProfileSetUp requires trimmed display_name AND title", () => {
    expect(isProfileSetUp(null)).toBe(false);
    expect(isProfileSetUp(defaultTrainerProfile())).toBe(false);
    expect(isProfileSetUp(parseTrainerProfile({ display_name: "Alex" }))).toBe(false);
    expect(isProfileSetUp(parseTrainerProfile({ display_name: " Alex ", title: " Coach " }))).toBe(true);
  });
});

describe("deriveInitials", () => {
  it("one word → first letter", () => {
    expect(deriveInitials("Marcus")).toBe("M");
  });
  it("two words → both letters", () => {
    expect(deriveInitials("alex zhang")).toBe("AZ");
  });
  it("three words → first two only", () => {
    expect(deriveInitials("Alex Zhang Wei")).toBe("AZ");
  });
  it("empty / whitespace → '?'", () => {
    expect(deriveInitials("")).toBe("?");
    expect(deriveInitials("   ")).toBe("?");
  });
});

describe("waMeLink", () => {
  it("strips non-digits", () => {
    expect(waMeLink("+852 9123 4567")).toBe("https://wa.me/85291234567");
  });
  it("no digits → null", () => {
    expect(waMeLink("call me")).toBeNull();
    expect(waMeLink("")).toBeNull();
  });
});

describe("qrContactTarget", () => {
  it("whatsapp wins when present", () => {
    expect(
      qrContactTarget(contact({ whatsapp: "+852 9123 4567", email: "a@b.co", website: "https://x.com" })),
    ).toBe("https://wa.me/85291234567");
  });
  it("whatsapp with no digits falls through to email", () => {
    expect(qrContactTarget(contact({ whatsapp: "nope", email: "a@b.co" }))).toBe("mailto:a@b.co");
  });
  it("email beats website", () => {
    expect(qrContactTarget(contact({ email: "a@b.co", website: "https://x.com" }))).toBe("mailto:a@b.co");
  });
  it("website used when it's all there is", () => {
    expect(qrContactTarget(contact({ website: "https://coach.site" }))).toBe("https://coach.site");
  });
  it("empty everything → null", () => {
    expect(qrContactTarget(contact())).toBeNull();
    expect(qrContactTarget(contact({ whatsapp: " ", email: "", instagram: null, website: undefined }))).toBeNull();
  });
});
