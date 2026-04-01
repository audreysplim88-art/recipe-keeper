// ─── Serving size calculator helpers ─────────────────────────────────────────
// Pure utility functions — no React dependency. Extracted from RecipeCard so
// they can be unit-tested in isolation and reused by future components.

/** Extract the first number from a servings string e.g. "4 servings" → 4, "6-8 people" → 6 */
export function parseServings(servings: string): number | null {
  const match = servings.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return isNaN(n) || n <= 0 ? null : n;
}

/** Parse an amount string to a decimal number. Returns null if not numeric. */
export function parseAmount(amount: string): number | null {
  const trimmed = amount.trim();

  // Mixed number: "2 1/2"
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);

  // Simple fraction: "1/2"
  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const den = parseInt(fraction[2]);
    if (den === 0) return null;
    return parseInt(fraction[1]) / den;
  }

  // Plain integer or decimal: "3", "1.5"
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/** Convert a decimal back to a readable amount string using nice fractions. */
export function formatAmount(value: number): string {
  if (value <= 0) return "0";

  // Common fractions as [numerator, denominator, display]
  const FRACTIONS: [number, number, string][] = [
    [1, 8, "1/8"], [1, 4, "1/4"], [1, 3, "1/3"], [3, 8, "3/8"],
    [1, 2, "1/2"], [5, 8, "5/8"], [2, 3, "2/3"], [3, 4, "3/4"], [7, 8, "7/8"],
  ];

  const whole = Math.floor(value);
  const decimal = value - whole;

  // Close enough to a whole number
  if (decimal < 0.05) return String(whole === 0 ? Math.round(value) : whole);
  if (decimal > 0.95) return String(whole + 1);

  // Find the closest common fraction
  let bestLabel = "";
  let bestError = Infinity;
  for (const [num, den, label] of FRACTIONS) {
    const error = Math.abs(decimal - num / den);
    if (error < bestError) {
      bestError = error;
      bestLabel = label;
    }
  }

  if (bestError < 0.07 && bestLabel) {
    return whole > 0 ? `${whole} ${bestLabel}` : bestLabel;
  }

  // Fall back to one decimal place
  return value.toFixed(1).replace(/\.0$/, "");
}

/** Scale an amount string by a multiplier. Returns { display, scaled }. */
export function scaleAmount(amount: string, multiplier: number): { display: string; scaled: boolean } {
  if (multiplier === 1) return { display: amount, scaled: false };
  const parsed = parseAmount(amount);
  if (parsed === null) return { display: amount, scaled: false };
  return { display: formatAmount(parsed * multiplier), scaled: true };
}
