import Anthropic from "@anthropic-ai/sdk";
import { Recipe } from "@/lib/types";

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
    recipe.dietaryTags && recipe.dietaryTags.length > 0
      ? `Dietary: ${recipe.dietaryTags.join(", ")}`
      : "";

  const allergenLine =
    recipe.allergens && recipe.allergens.length > 0
      ? `Allergens: ${recipe.allergens.join(", ")}`
      : "";

  const metaLines = [dietaryLine, allergenLine].filter(Boolean).join(" | ");

  return `You are a warm, experienced sous chef guiding someone through cooking a recipe step by step.

PERSONA:
- Friendly, encouraging, and concise — like a trusted friend in the kitchen
- Short, clear sentences. The cook's hands are busy, so keep responses to 2–3 sentences maximum
- Natural spoken prose only — no markdown, no bullet points, no lists
- Spell out numbers and measurements in full ("two tablespoons", not "2 tbsp") so text-to-speech reads naturally

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
- Begin the very first message by warmly greeting the cook, naming the dish, and asking if they have all their ingredients ready
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
  try {
    const body: SousChefRequest = await request.json();
    const { messages, recipe } = body;

    if (!recipe || !recipe.title) {
      return Response.json({ error: "A recipe is required." }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "At least one message is required." }, { status: 400 });
    }

    // Sliding window: keep last 20 messages (10 exchanges) to stay within context limits
    const recentMessages = messages.slice(-20);

    const systemPrompt = buildSystemPrompt(recipe);

    // Build the SSE stream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = client.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 300,
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
