import { describe, expect, it } from "vitest";
import { filterCountries, isValidCountryName } from "@/lib/countries";

describe("country selector data", () => {
  it("filters partial names like Sou to South Africa", () => {
    const matches = filterCountries("Sou");
    expect(matches.some((c) => c.name === "South Africa")).toBe(true);
  });

  it("filters Uni to United States and United Kingdom", () => {
    const matches = filterCountries("Uni");
    const names = matches.map((c) => c.name);
    expect(names).toContain("United States");
    expect(names).toContain("United Kingdom");
  });

  it("rejects arbitrary one-letter text as valid country", () => {
    expect(isValidCountryName("D")).toBe(false);
    expect(isValidCountryName("United States")).toBe(true);
  });
});
