import { parseServings, parseAmount, formatAmount, scaleAmount } from "@/lib/scaling";

// ─── parseServings ────────────────────────────────────────────────────────────

describe("parseServings", () => {
  it("extracts integer from plain number string", () => {
    expect(parseServings("4")).toBe(4);
  });

  it("extracts first number from descriptive string", () => {
    expect(parseServings("4 servings")).toBe(4);
    expect(parseServings("6-8 people")).toBe(6);
    expect(parseServings("Makes 12 cookies")).toBe(12);
  });

  it("extracts decimal servings", () => {
    expect(parseServings("2.5")).toBe(2.5);
  });

  it("returns null for zero", () => {
    expect(parseServings("0")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseServings("a few")).toBeNull();
    expect(parseServings("")).toBeNull();
  });
});

// ─── parseAmount ─────────────────────────────────────────────────────────────

describe("parseAmount", () => {
  it("parses plain integer", () => {
    expect(parseAmount("3")).toBe(3);
  });

  it("parses decimal", () => {
    expect(parseAmount("1.5")).toBe(1.5);
  });

  it("parses simple fraction", () => {
    expect(parseAmount("1/2")).toBeCloseTo(0.5);
    expect(parseAmount("1/4")).toBeCloseTo(0.25);
    expect(parseAmount("2/3")).toBeCloseTo(0.667, 2);
  });

  it("parses mixed number", () => {
    expect(parseAmount("2 1/2")).toBeCloseTo(2.5);
    expect(parseAmount("1 3/4")).toBeCloseTo(1.75);
  });

  it("returns null for non-numeric string", () => {
    expect(parseAmount("a handful")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("to taste")).toBeNull();
  });

  it("returns null for division by zero fraction", () => {
    expect(parseAmount("1/0")).toBeNull();
  });
});

// ─── formatAmount ─────────────────────────────────────────────────────────────

describe("formatAmount", () => {
  it("formats whole numbers", () => {
    expect(formatAmount(1)).toBe("1");
    expect(formatAmount(3)).toBe("3");
  });

  it("returns '0' for zero or negative", () => {
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(-1)).toBe("0");
  });

  it("formats simple fractions", () => {
    expect(formatAmount(0.5)).toBe("1/2");
    expect(formatAmount(0.25)).toBe("1/4");
    expect(formatAmount(0.75)).toBe("3/4");
    expect(formatAmount(0.333)).toBe("1/3");
  });

  it("formats mixed numbers", () => {
    expect(formatAmount(2.5)).toBe("2 1/2");
    expect(formatAmount(1.75)).toBe("1 3/4");
    expect(formatAmount(3.25)).toBe("3 1/4");
  });

  it("rounds near-whole decimals to whole number", () => {
    expect(formatAmount(1.98)).toBe("2");
    expect(formatAmount(2.02)).toBe("2");
  });

  it("falls back to one decimal place for unrecognised fractions", () => {
    // 0.052 is closest to 1/8 (0.125) but the error (0.073) exceeds the 0.07 tolerance
    expect(formatAmount(0.052)).toBe("0.1");
  });
});

// ─── scaleAmount ──────────────────────────────────────────────────────────────

describe("scaleAmount", () => {
  it("returns original amount unchanged when multiplier is 1", () => {
    expect(scaleAmount("2 cups", 1)).toEqual({ display: "2 cups", scaled: false });
    expect(scaleAmount("1/2", 1)).toEqual({ display: "1/2", scaled: false });
  });

  it("scales a plain number", () => {
    expect(scaleAmount("2", 2)).toEqual({ display: "4", scaled: true });
    expect(scaleAmount("4", 0.5)).toEqual({ display: "2", scaled: true });
  });

  it("scales a fraction", () => {
    expect(scaleAmount("1/2", 2)).toEqual({ display: "1", scaled: true });
    expect(scaleAmount("1/4", 4)).toEqual({ display: "1", scaled: true });
  });

  it("scales a mixed number", () => {
    expect(scaleAmount("2 1/2", 2)).toEqual({ display: "5", scaled: true });
  });

  it("returns non-numeric amounts unscaled", () => {
    expect(scaleAmount("to taste", 3)).toEqual({ display: "to taste", scaled: false });
    expect(scaleAmount("a handful", 2)).toEqual({ display: "a handful", scaled: false });
  });

  it("produces nice fractions when result is fractional", () => {
    // 1 cup ÷ 2 = 1/2 cup
    expect(scaleAmount("1", 0.5)).toEqual({ display: "1/2", scaled: true });
  });
});
