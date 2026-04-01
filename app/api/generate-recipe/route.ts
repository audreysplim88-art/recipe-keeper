import Anthropic from "@anthropic-ai/sdk";
import { RecipeGenerationResult } from "@/lib/types";
import { RECIPE_MODEL, RECIPE_MAX_TOKENS, MIN_TRANSCRIPT_CHARS } from "@/lib/constants";
import { RECIPE_JSON_SCHEMA, RECIPE_SHARED_RULES, stripCodeFences } from "@/lib/prompts";
import { handleAnthropicError } from "@/lib/api-utils";

// Allow up to 60 s on Vercel Pro (Claude can take 20–40 s for long recipes)
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a recipe scribe with a gift for capturing not just instructions, but the soul of cooking.

You MUST return a valid JSON object with exactly this shape:
${RECIPE_JSON_SCHEMA}

CRITICAL RULES:
${RECIPE_SHARED_RULES}
- Make reasonable estimates for times and quantities if not stated explicitly.`;

const USER_MESSAGES: Record<string, (content: string) => string> = {
  narration: (content) =>
    `Here is my cooking narration — rambling, personal, exactly as I said it. Please extract a complete recipe, and pay special attention to every tip, trick, or personal insight I mentioned:\n\n${content}`,

  text: (content) =>
    `Here is a written recipe (pasted from a document or typed up from notes). Please structure it into the required format. Extract any implicit tips or technique notes you notice, even if the original didn't label them as such:\n\n${content}`,

  url: (content) =>
    `Here is the text content extracted from a recipe webpage. Please structure it into the required format, extracting any tips, technique notes, or useful asides the author included:\n\n${content}`,

  instagram: (content) =>
    `Here is the caption from an Instagram Reel where the creator shared their recipe. Captions are informal and may include hashtags (#tag) and @mentions — ignore those. Extract a complete recipe from whatever the creator shared. If they listed ingredients or steps, capture them carefully. Make sensible estimates for any missing quantities or timing, and treat any personal touches or technique hints as tips:\n\n${content}`,
};

export async function POST(request: Request) {
  try {
    const { transcript, source = "narration" } = await request.json();

    if (!transcript || typeof transcript !== "string" || transcript.trim().length < MIN_TRANSCRIPT_CHARS) {
      return Response.json({ error: "Please provide some recipe content." }, { status: 400 });
    }

    const getUserMessage = USER_MESSAGES[source] ?? USER_MESSAGES.narration;

    const stream = client.messages.stream({
      model: RECIPE_MODEL,
      max_tokens: RECIPE_MAX_TOKENS,
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
      recipeData = JSON.parse(stripCodeFences(textBlock.text));
    } catch {
      return Response.json({ error: "Failed to parse recipe. Please try again." }, { status: 500 });
    }

    return Response.json({ recipe: recipeData });
  } catch (error) {
    return handleAnthropicError(error, "Recipe generation");
  }
}
