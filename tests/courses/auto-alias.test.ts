import { describe, expect, it } from "bun:test";
import { generateAliasMap, generateAutoAlias } from "../../src/lib/courses/auto-alias.js";

describe("generateAutoAlias", () => {
  it("takes first significant token", () => {
    expect(generateAutoAlias("TERAPÉUTICA FARMACOLÓGICA III")).toBe("terapeutica");
  });

  it("strips accents", () => {
    expect(generateAutoAlias("FARMACOLOGÍA CLÍNICA")).toBe("farmacologia");
  });

  it("skips stopwords", () => {
    expect(generateAutoAlias("LABORATORIO Y DIAGNÓSTICO II")).toBe("laboratorio");
  });

  it("deduplicates with counter", () => {
    const existing = new Set(["farmacia"]);
    expect(generateAutoAlias("FARMACIA CLÍNICA I", existing)).toBe("farmacia2");
  });

  it("deduplicates with counter for third collision", () => {
    const existing = new Set(["farmacia", "farmacia2"]);
    expect(generateAutoAlias("FARMACIA GENERAL", existing)).toBe("farmacia3");
  });

  it("handles single-word name", () => {
    expect(generateAutoAlias("BIOQUÍMICA")).toBe("bioquimica");
  });

  it("handles name with only stopwords gracefully", () => {
    const result = generateAutoAlias("DE LA EL");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("generateAliasMap", () => {
  it("generates unique aliases for all courses", () => {
    const courses = [
      { code: "FB6N1", name: "TERAPÉUTICA FARMACOLÓGICA III" },
      { code: "FB6N2", name: "FARMACIA CLÍNICA I" },
      { code: "FB6M4", name: "LABORATORIO Y DIAGNÓSTICO II" },
      { code: "AC6M28", name: "CIENCIA Y DESCUBRIMIENTO" },
    ];
    const map = generateAliasMap(courses);
    const values = Object.values(map);
    const unique = new Set(values);
    expect(unique.size).toBe(courses.length);
  });

  it("handles courses with same first token via dedup", () => {
    const courses = [
      { code: "FB6N2A", name: "FARMACIA CLÍNICA I" },
      { code: "FB6N2B", name: "FARMACIA CLÍNICA II" },
    ];
    const map = generateAliasMap(courses);
    expect(Object.values(map)[0]).toBe("farmacia");
    expect(Object.values(map)[1]).toBe("farmacia2");
  });
});
