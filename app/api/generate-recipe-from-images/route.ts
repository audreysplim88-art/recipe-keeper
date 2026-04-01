/**
 * Accepts 1–5 photos of a recipe (base64-encoded JPEG/PNG/WebP/GIF),
 * sends them all to Claude in a single vision request, and returns the same
 * RecipeGenerationResult shape as the text-based generate-recipe route.
 *
 * Images are expected to be resized client-side (max 1920 px longest edge)
 * before this endpoint is called; we do no server-side image processing.
 */

// Allow up to 60 s on Vercel Pro (vision requests with multiple images can be slow)
export const maxDuration = 60;

import Anthropic from "@anthropic-ai/sdk";
import { RecipeGenerationResult } from "@/lib/types";
import { RECIPE_MODEL, RECIPE_MAX_TOKENS, PHOTO_MAX_COUNT } from "@/lib/constants";
import { RECIPE_JSON_SCHEMA, RECIPE_SHARED_RULES, stripCodeFences } from "@/lib/prompts";
import { handleAnthropicError } from "@/lib/api-utils";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

// ─── System prompt ────────────────────────────────────────────────────────────
// Intentionally kept separate from the text route — vision calls have different
// context (photographs may be blurry, partial, or span several pages) so the
// guidance is tuned accordingly. The JSON output shape is identical.

const SYSTEM_PROMPT = `You are a recipe scribe with a gift for capturing not just instructions, but the soul of cooking. You are reading one or more photographs of a recipe — a cookbook page, a recipe card, a magazine cutting, or handwritten notes. There may be up to 5 images representing different pages of the same recipe. Read everything visible across all images and synthesise one complete recipe.

You MUST return a valid JSON object with exactly this shape:
${RECIPE_JSON_SCHEMA}

CRITICAL RULES:
${RECIPE_SHARED_RULES}
- Make reasonable estimates for times and quantities if they are unclear or partially obscured in the photos.`;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const images: Array<{ base64: string; mediaType: string }> = body.images;

    // ── Input validation ─────────────────────────────────────────────────────

    if (!Array.isArray(images) || images.length === 0) {
      return Response.json(
        { error: "Please add at least one photo before extracting." },
        { status: 400 }
      );
    }

    if (images.length > PHOTO_MAX_COUNT) {
      return Response.json(
        { error: `Please provide at most ${PHOTO_MAX_COUNT} photos at a time.` },
        { status: 400 }
      );
    }

    for (const [i, img] of images.entries()) {
      if (!img.base64 || typeof img.base64 !== "string" || img.base64.trim() === "") {
        return Response.json(
          { error: `Photo ${i + 1} is missing image data.` },
          { status: 400 }
        );
      }
      if (!SUPPORTED_MEDIA_TYPES.includes(img.mediaType as SupportedMediaType)) {
        return Response.json(
          { error: `Photo ${i + 1} has an unsupported format. Please use JPEG, PNG, WebP or GIF.` },
          { status: 400 }
        );
      }
    }

    // ── Build Claude vision request ──────────────────────────────────────────
    // Content is an array of image blocks followed by a single text block.

    const imageBlocks = images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: img.mediaType as SupportedMediaType,
        data: img.base64,
      },
    }));

    const n = images.length;
    const textBlock = {
      type: "text" as const,
      text:
        n === 1
          ? "This is a photo of a recipe. Please read it carefully and extract the complete recipe."
          : `These are ${n} photos of a recipe that may span multiple pages. Please read all ${n} photos in order and combine everything into one complete recipe.`,
    };

    // ── Call Claude ──────────────────────────────────────────────────────────

    const stream = client.messages.stream({
      model: RECIPE_MODEL,
      max_tokens: RECIPE_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: [...imageBlocks, textBlock] }],
    });

    const response = await stream.finalMessage();

    const textContent = response.content.find((b) => b.type === "text");
    if (!textContent || textContent.type !== "text") {
      return Response.json({ error: "No recipe generated." }, { status: 500 });
    }

    // ── Parse response ───────────────────────────────────────────────────────

    let recipeData: RecipeGenerationResult;
    try {
      recipeData = JSON.parse(stripCodeFences(textContent.text));
    } catch {
      return Response.json(
        { error: "Failed to parse recipe. Please try again." },
        { status: 500 }
      );
    }

    return Response.json({ recipe: recipeData });
  } catch (error) {
    return handleAnthropicError(error, "Image recipe generation");
  }
}
