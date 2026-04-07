/**
 * Shared prompt fragments for recipe generation.
 *
 * Both the text route (generate-recipe) and the vision route
 * (generate-recipe-from-images) produce the same JSON output shape and share
 * the same output rules. Keeping that content here means a schema change or
 * rule tweak only needs to happen in one place.
 *
 * Each route still owns its own system prompt introduction because the
 * context differs: text routes receive narrations/URLs, vision routes receive
 * photographs.
 */

// ─── JSON output schema ───────────────────────────────────────────────────────

/**
 * The exact JSON shape Claude must return for recipe generation.
 * Interpolated into the system prompt of both generation routes.
 */
export const RECIPE_JSON_SCHEMA = `{
  "title": "string — a warm, descriptive recipe name",
  "description": "string — one concise plain-English sentence describing the dish (e.g. 'Whole roast duck in a honey-orange glaze and Grand Marnier sauce'). No marketing language, no superlatives.",
  "category": "one of: starters | mains | desserts | sides | soups-salads | breakfast | snacks | drinks | sauces | other",
  "dietaryTags": ["array of applicable tags from: vegan | vegetarian | gluten-free | dairy-free | nut-free — empty array if none apply"],
  "allergens": ["array of present allergens from the EU/UK Big 14: gluten | crustaceans | eggs | fish | peanuts | soy | dairy | tree-nuts | celery | mustard | sesame | sulphites | lupin | molluscs — empty array if none"],
  "servings": "string — e.g. '4 servings' or '6-8 people'",
  "prepTime": "string — e.g. '20 minutes' or 'about half an hour'",
  "cookTime": "string — e.g. '45 minutes'",
  "ingredients": [
    {
      "amount": "string — the quantity, e.g. '2', '1/2', 'a handful'",
      "unit": "string — e.g. 'cups', 'tbsp', 'cloves', '' (empty if none)",
      "name": "string — the ingredient name",
      "notes": "string or null — optional notes like 'room temperature' or 'finely chopped'"
    }
  ],
  "instructions": [
    "string — each step as a clear, complete sentence"
  ],
  "tips": [
    {
      "category": "tip" | "trick" | "secret" | "note",
      "content": "string — the insight, personal touch, or technique note"
    }
  ]
}`;

// ─── Shared critical rules ────────────────────────────────────────────────────

/**
 * Output rules that are identical across all generation routes.
 * Each route appends one context-specific rule about estimates (text says
 * "if not stated explicitly"; vision says "if obscured in the photos").
 *
 * Note: no trailing newline — each route appends its estimates rule on the
 * next line.
 */
export const RECIPE_SHARED_RULES = `- The "tips" array captures wisdom that doesn't appear in standard recipe steps: sensory cues (look for X, it should smell like Y), technique nuances, ingredient preferences, substitution notes, or anything that helps someone cook this dish *well*.
- Separate the WHAT (instructions) from the WHY and HOW THEY KNOW (tips).
- Choose the most appropriate "category" based on the dish — use "other" only as a last resort.
- For "dietaryTags": only include a tag if the recipe genuinely meets that standard (e.g. vegan means no animal products at all).
- For "allergens": be thorough — scan every ingredient and include all relevant EU/UK Big 14 allergens present.
- ALWAYS use standard abbreviations for measurement units in ingredients: tbsp (tablespoon), tsp (teaspoon), oz (ounce), lb (pound), g (gram), kg (kilogram), ml (millilitre), L (litre), cup, pinch, dash, clove. Never spell out "tablespoon", "teaspoon", etc. in the ingredients array.
- Return ONLY the JSON object, no markdown, no explanation.`;

// ─── Response utilities ───────────────────────────────────────────────────────

/**
 * Strips markdown code fences that Claude occasionally wraps around its JSON
 * response despite being instructed not to. Safe to call on any string.
 */
export function stripCodeFences(text: string): string {
  return text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
}
