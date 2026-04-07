import Anthropic from "@anthropic-ai/sdk";
import { Recipe } from "@/lib/types";
import { RECIPE_MODEL, SOUS_CHEF_MAX_TOKENS, SOUS_CHEF_CONVERSATION_WINDOW } from "@/lib/constants";
import { requireAuth } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SousChefRequest {
  messages: ConversationMessage[];
  recipe: Recipe;
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(recipe: Recipe): string {
  const ingredientList = recipe.ingredients
    .map((ing) => {
      const parts = [ing.amount, ing.unit, ing.name].filter(Boolean).join(" ");
      return `- ${parts}${ing.notes ? ` (${ing.notes})` : ""}`;
    })
    .join("\n");

  const stepList = recipe.instructions
    .map((step, i) => `${i + 1}. ${step}`)
    .join("\n");

  const tipList =
    recipe.tips.length > 0
      ? recipe.tips.map((t) => `- [${t.category}] ${t.content}`).join("\n")
      : "None";

  const dietaryLine =
    recipe.dietaryTags.length > 0
      ? `Dietary: ${recipe.dietaryTags.join(", ")}`
      : "";

  const allergenLine =
    recipe.allergens.length > 0
      ? `Allergens: ${recipe.allergens.join(", ")}`
      : "";

  const metaLines = [dietaryLine, allergenLine].filter(Boolean).join(" | ");

  return `You are a warm, experienced sous chef guiding someone through cooking a recipe step by step.

PERSONA:
- Friendly, encouraging, and concise — like a trusted friend in the kitchen
- Short, clear sentences. The cook's hands are busy, so keep responses to 2–3 sentences maximum
- Natural spoken prose only — no markdown, no bullet points, no lists
- Spell out numbers and measurements in full ("two tablespoons", not "2 tbsp") so text-to-speech reads naturally
- NEVER open a response with filler affirmations. Banned opening words: "Great!", "Of course!", "Absolutely!", "Sure!", "Certainly!", "Happy to help!", "Sounds good!", "Perfect!", "Wonderful!", "Excellent!"
- Begin every response by directly addressing the cook's question or the next action. Warmth comes from your word choice, not from pleasantries.
- 1–2 sentences for simple confirmations; 2–3 sentences only for multi-part instructions. Never longer.

RECIPE: ${recipe.title}
${recipe.description}
Serves: ${recipe.servings} | Prep: ${recipe.prepTime} | Cook: ${recipe.cookTime}
${metaLines ? metaLines + "\n" : ""}
INGREDIENTS:
${ingredientList}

STEPS:
${stepList}

TIPS & SECRETS:
${tipList}

RULES:
- Begin the very first message with exactly: "Hello, chef! I'm ready to guide you through making [recipe title]. Ready when you are." — substituting the actual recipe title. One sentence only. No follow-up questions in the opening message.
- Guide through steps one at a time; only advance when the cook confirms they're done or asks to move on
- Surface tips and secrets naturally at the relevant step — not all upfront
- If the cook asks a general cooking question, answer briefly (1–2 sentences) then return to the current step
- If an ingredient is missing, suggest a quick substitution without derailing the flow
- When the cook finishes the final step, congratulate them warmly and optionally add a plating tip
- Never mention "step numbers" robotically — say things like "now we'll..." or "next up..."
- Keep track of where you are; do not skip steps or repeat completed ones`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Authentication
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  // Rate limit: 30 messages per 10 minutes per user
  if (!checkRateLimit(`sous-chef:${auth.user.id}`, 30, 10 * 60 * 1000)) {
    return Response.json(
      { error: "Too many requests. Please wait a moment before continuing." },
      { status: 429 }
    );
  }

  try {
    const body: SousChefRequest = await request.json();
    const { messages, recipe } = body;

    if (!recipe || !recipe.title) {
      return Response.json({ error: "A recipe is required." }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "At least one message is required." }, { status: 400 });
    }

    // Sliding window: keep last N messages to stay within context limits
    const recentMessages = messages.slice(-SOUS_CHEF_CONVERSATION_WINDOW);

    const systemPrompt = buildSystemPrompt(recipe);

    // Build the SSE stream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = client.messages.stream({
            model: RECIPE_MODEL,
            max_tokens: SOUS_CHEF_MAX_TOKENS,
            system: systemPrompt,
            messages: recentMessages,
          });

          for await (const event of anthropicStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const chunk = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Sous chef stream error:", err);
          const message =
            err instanceof Anthropic.AuthenticationError
              ? "Invalid API key."
              : "Something went wrong. Please try again.";
          const errChunk = JSON.stringify({ error: message });
          controller.enqueue(encoder.encode(`data: ${errChunk}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "Invalid API key. Please check your ANTHROPIC_API_KEY." },
        { status: 401 }
      );
    }
    console.error("Sous chef API error:", error);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
