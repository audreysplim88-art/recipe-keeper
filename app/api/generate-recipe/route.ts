import Anthropic from "@anthropic-ai/sdk";
import { RecipeGenerationResult } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a recipe scribe with a gift for capturing not just instructions, but the soul of cooking.

Your job is to listen to a cook narrate their process — which may be rambling, conversational, and full of personal insights — and distill it into a structured recipe.

You MUST return a valid JSON object with exactly this shape:
{
  "title": "string — a warm, descriptive recipe name",
  "description": "string — 1-2 sentences capturing the spirit of the dish",
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
- The "tips" array is the most important part. Capture EVERY personal insight, sensory cue (look for X, it should smell like Y, feel for Z), technique nuance, ingredient preference, or "my mother always..." moment.
- If the cook says something like "you want it to look golden, not brown" or "I only use this brand" or "the trick is to not rush this part" — that goes in tips.
- Separate the WHAT (instructions) from the WHY and HOW THEY KNOW (tips).
- Make reasonable estimates for times and quantities if not stated explicitly.
- Return ONLY the JSON object, no markdown, no explanation.`;

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();

    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
      return Response.json({ error: "Please provide a recipe narration." }, { status: 400 });
    }

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is my cooking narration. Please extract a complete recipe from it:\n\n${transcript}`,
        },
      ],
    });

    const response = await stream.finalMessage();

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "No recipe generated." }, { status: 500 });
    }

    let recipeData: RecipeGenerationResult;
    try {
      // Strip any accidental markdown code fences
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
