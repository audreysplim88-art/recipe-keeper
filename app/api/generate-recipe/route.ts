import Anthropic from "@anthropic-ai/sdk";
import { RecipeGenerationResult } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a recipe scribe with a gift for capturing not just instructions, but the soul of cooking.

You MUST return a valid JSON object with exactly this shape:
{
  "title": "string — a warm, descriptive recipe name",
  "description": "string — 1-2 sentences capturing the spirit of the dish",
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
}

CRITICAL RULES:
- The "tips" array captures wisdom that doesn't appear in standard recipe steps: sensory cues (look for X, it should smell like Y), technique nuances, ingredient preferences, substitution notes, or anything that helps someone cook this dish *well*.
- Separate the WHAT (instructions) from the WHY and HOW THEY KNOW (tips).
- Make reasonable estimates for times and quantities if not stated explicitly.
- Choose the most appropriate "category" based on the dish — use "other" only as a last resort.
- For "dietaryTags": only include a tag if the recipe genuinely meets that standard (e.g. vegan means no animal products at all).
- For "allergens": be thorough — scan every ingredient and include all relevant EU/UK Big 14 allergens present.
- Return ONLY the JSON object, no markdown, no explanation.`;

const USER_MESSAGES: Record<string, (content: string) => string> = {
  narration: (content) =>
    `Here is my cooking narration — rambling, personal, exactly as I said it. Please extract a complete recipe, and pay special attention to every tip, trick, or personal insight I mentioned:\n\n${content}`,

  text: (content) =>
    `Here is a written recipe (pasted from a document or typed up from notes). Please structure it into the required format. Extract any implicit tips or technique notes you notice, even if the original didn't label them as such:\n\n${content}`,

  url: (content) =>
    `Here is the text content extracted from a recipe webpage. Please structure it into the required format, extracting any tips, technique notes, or useful asides the author included:\n\n${content}`,
};

export async function POST(request: Request) {
  try {
    const { transcript, source = "narration" } = await request.json();

    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
      return Response.json({ error: "Please provide some recipe content." }, { status: 400 });
    }

    const getUserMessage = USER_MESSAGES[source] ?? USER_MESSAGES.narration;

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: getUserMessage(transcript) }],
    });

    const response = await stream.finalMessage();

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "No recipe generated." }, { status: 500 });
    }

    let recipeData: RecipeGenerationResult;
    try {
      const cleaned = textBlock.text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      recipeData = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: "Failed to parse recipe. Please try again." }, { status: 500 });
    }

    return Response.json({ recipe: recipeData });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Invalid API key. Please check your ANTHROPIC_API_KEY." }, { status: 401 });
    }
    console.error("Recipe generation error:", error);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
