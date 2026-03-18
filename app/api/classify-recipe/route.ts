import Anthropic from "@anthropic-ai/sdk";
import { DietaryTag, AllergenTag } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a food allergen and dietary classification assistant.

Given a recipe's title, description and ingredient list, return ONLY a valid JSON object with this exact shape:
{
  "dietaryTags": ["array from: vegan | vegetarian | gluten-free | dairy-free | nut-free"],
  "allergens": ["array from EU/UK Big 14: gluten | crustaceans | eggs | fish | peanuts | soy | dairy | tree-nuts | celery | mustard | sesame | sulphites | lupin | molluscs"]
}

RULES:
- Only include a dietary tag if the recipe genuinely meets that standard (vegan = zero animal products).
- Be thorough with allergens — scan every ingredient carefully, including stock, sauces, and condiments which often contain hidden allergens.
- Return ONLY the JSON object, no markdown, no explanation.`;

export async function POST(request: Request) {
  try {
    const { title, description, ingredients } = await request.json();

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return Response.json({ error: "No ingredients provided." }, { status: 400 });
    }

    const ingredientList = ingredients
      .map((i: { amount?: string; unit?: string; name: string; notes?: string }) => {
        const parts = [i.amount, i.unit, i.name, i.notes ? `(${i.notes})` : ""]
          .filter(Boolean).join(" ");
        return `- ${parts}`;
      })
      .join("\n");

    const userMessage = `Recipe: ${title || "Untitled"}\n${description ? `Description: ${description}\n` : ""}Ingredients:\n${ingredientList}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "No classification returned." }, { status: 500 });
    }

    let result: { dietaryTags: DietaryTag[]; allergens: AllergenTag[] };
    try {
      const cleaned = textBlock.text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: "Failed to parse classification." }, { status: 500 });
    }

    return Response.json(result);
  } catch (error) {
    console.error("Classification error:", error);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
