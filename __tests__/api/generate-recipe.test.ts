/**
 * @jest-environment node
 */

/**
 * Tests for app/api/generate-recipe/route.ts
 *
 * The Anthropic SDK is mocked — no real API calls are made.
 * We test:
 *  - Input validation (missing/short/non-string transcript)
 *  - Source-specific user message prompts: narration, text, url, instagram
 *  - Instagram prompt specifics: mentions Reel, hashtags, @mentions, estimates
 *  - Unknown source falls back to narration prompt
 *  - Successful recipe parsing and response shape
 *  - Markdown code-fence stripping from Claude output
 *  - Model and system prompt pass-through
 *  - Authentication error (401) and generic error (500) handling
 */

import { POST } from "@/app/api/generate-recipe/route";
import { MIN_TRANSCRIPT_CHARS, CAPTURE_MIN_CONTENT_CHARS } from "@/lib/constants";

// ─── Mock Anthropic SDK ───────────────────────────────────────────────────────

// Mutable state written by each test; hoisted into jest.mock via reference.
const mockState = {
  responseText: "",
  shouldThrow: null as Error | null,
  lastCallArgs: null as unknown,
};

jest.mock("@anthropic-ai/sdk", () => {
  class AuthenticationError extends Error {
    status = 401;
    constructor(message: string) {
      super(message);
      this.name = "AuthenticationError";
    }
  }

  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: {
      stream: (args: unknown) => {
        mockState.lastCallArgs = args;
        return {
          finalMessage: async () => {
            if (mockState.shouldThrow) throw mockState.shouldThrow;
            return {
              content: [{ type: "text", text: mockState.responseText }],
            };
          },
        };
      },
    },
  }));

  (MockAnthropic as unknown as Record<string, unknown>).AuthenticationError =
    AuthenticationError;

  return { __esModule: true, default: MockAnthropic };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

const VALID_RECIPE_JSON = JSON.stringify({
  title: "Spaghetti Carbonara",
  description: "Classic Roman pasta.",
  category: "mains",
  dietaryTags: [],
  allergens: ["gluten", "eggs", "dairy"],
  servings: "2 servings",
  prepTime: "10 minutes",
  cookTime: "20 minutes",
  ingredients: [{ amount: "200g", unit: "", name: "spaghetti", notes: null }],
  instructions: ["Boil pasta.", "Mix eggs and cheese.", "Combine off heat."],
  tips: [{ category: "secret", content: "Use pasta water to loosen." }],
});

// Transcripts long enough to pass the 10-char minimum
const NARRATION = "I'm cooking my famous carbonara — let me talk you through it.";
const INSTAGRAM_CAPTION =
  "My carbonara recipe #pasta #carbonara @chefsecrets — 200g spaghetti, 3 yolks, 100g pecorino, guanciale. Cook pasta, fry guanciale, mix yolks off heat.";

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockState.responseText = VALID_RECIPE_JSON;
  mockState.shouldThrow = null;
  mockState.lastCallArgs = null;
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe("input validation", () => {
  it("returns 400 when transcript is missing", async () => {
    const res = await POST(makeRequest({ source: "url" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/provide some recipe content/i);
  });

  it("returns 400 when transcript is not a string", async () => {
    const res = await POST(makeRequest({ transcript: 42, source: "url" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/provide some recipe content/i);
  });

  it("returns 400 when transcript is below MIN_TRANSCRIPT_CHARS", async () => {
    const tooShort = "x".repeat(MIN_TRANSCRIPT_CHARS - 1);
    const res = await POST(makeRequest({ transcript: tooShort, source: "url" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/provide some recipe content/i);
  });

  it("accepts transcript at exactly MIN_TRANSCRIPT_CHARS (API lower bound)", async () => {
    // The API backstop fires at MIN_TRANSCRIPT_CHARS; this content is just enough.
    const atLimit = "x".repeat(MIN_TRANSCRIPT_CHARS);
    const res = await POST(makeRequest({ transcript: atLimit, source: "url" }));
    expect(res.status).toBe(200);
  });

  it("accepts transcript between MIN_TRANSCRIPT_CHARS and CAPTURE_MIN_CONTENT_CHARS", async () => {
    // The UI guard (CAPTURE_MIN_CONTENT_CHARS) is higher than the API guard, so
    // this content would never be sent from the UI — but the API must still accept
    // it to support direct calls and future integrations.
    const midRange = "x".repeat(CAPTURE_MIN_CONTENT_CHARS - 1);
    expect(midRange.length).toBeGreaterThanOrEqual(MIN_TRANSCRIPT_CHARS);
    const res = await POST(makeRequest({ transcript: midRange, source: "url" }));
    expect(res.status).toBe(200);
  });
});

// ─── Source prompt variants ───────────────────────────────────────────────────

describe("source prompt variants", () => {
  it("uses the narration prompt for source=narration", async () => {
    await POST(makeRequest({ transcript: NARRATION, source: "narration" }));
    const args = mockState.lastCallArgs as { messages: Array<{ content: string }> };
    expect(args.messages[0].content).toMatch(/cooking narration/i);
  });

  it("defaults to the narration prompt when source is omitted", async () => {
    await POST(makeRequest({ transcript: NARRATION }));
    const args = mockState.lastCallArgs as { messages: Array<{ content: string }> };
    expect(args.messages[0].content).toMatch(/cooking narration/i);
  });

  it("uses the text prompt for source=text", async () => {
    await POST(makeRequest({ transcript: NARRATION, source: "text" }));
    const args = mockState.lastCallArgs as { messages: Array<{ content: string }> };
    expect(args.messages[0].content).toMatch(/written recipe/i);
  });

  it("uses the url prompt for source=url", async () => {
    await POST(makeRequest({ transcript: NARRATION, source: "url" }));
    const args = mockState.lastCallArgs as { messages: Array<{ content: string }> };
    expect(args.messages[0].content).toMatch(/recipe webpage/i);
  });

  it("uses the instagram prompt for source=instagram", async () => {
    await POST(makeRequest({ transcript: INSTAGRAM_CAPTION, source: "instagram" }));
    const args = mockState.lastCallArgs as { messages: Array<{ content: string }> };
    expect(args.messages[0].content).toMatch(/instagram reel/i);
  });

  it("falls back to the narration prompt for an unrecognised source", async () => {
    await POST(makeRequest({ transcript: NARRATION, source: "tiktok" }));
    const args = mockState.lastCallArgs as { messages: Array<{ content: string }> };
    expect(args.messages[0].content).toMatch(/cooking narration/i);
  });

  it("always appends the transcript content to the user message", async () => {
    await POST(makeRequest({ transcript: INSTAGRAM_CAPTION, source: "instagram" }));
    const args = mockState.lastCallArgs as { messages: Array<{ content: string }> };
    expect(args.messages[0].content).toContain(INSTAGRAM_CAPTION);
  });
});

// ─── Instagram prompt specifics ───────────────────────────────────────────────

describe("instagram prompt", () => {
  async function getInstagramUserMessage(): Promise<string> {
    await POST(makeRequest({ transcript: INSTAGRAM_CAPTION, source: "instagram" }));
    const args = mockState.lastCallArgs as { messages: Array<{ content: string }> };
    return args.messages[0].content;
  }

  it("references Instagram Reel as the source", async () => {
    expect(await getInstagramUserMessage()).toMatch(/instagram reel/i);
  });

  it("instructs Claude to ignore hashtags", async () => {
    expect(await getInstagramUserMessage()).toMatch(/hashtag/i);
  });

  it("instructs Claude to ignore @mentions", async () => {
    expect(await getInstagramUserMessage()).toMatch(/@mention/i);
  });

  it("instructs Claude to make sensible estimates for missing quantities or timing", async () => {
    expect(await getInstagramUserMessage()).toMatch(/estimate/i);
  });

  it("instructs Claude to treat personal touches as tips", async () => {
    expect(await getInstagramUserMessage()).toMatch(/tip/i);
  });
});

// ─── Successful generation ────────────────────────────────────────────────────

describe("successful generation", () => {
  it("returns 200 with a structured recipe object", async () => {
    const res = await POST(makeRequest({ transcript: NARRATION, source: "instagram" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipe.title).toBe("Spaghetti Carbonara");
    expect(body.recipe.ingredients).toHaveLength(1);
    expect(body.recipe.instructions).toHaveLength(3);
    expect(body.recipe.tips).toHaveLength(1);
    expect(body.recipe.allergens).toContain("eggs");
  });

  it("strips markdown code fences before parsing", async () => {
    mockState.responseText = `\`\`\`json\n${VALID_RECIPE_JSON}\n\`\`\``;
    const res = await POST(makeRequest({ transcript: NARRATION, source: "url" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipe.title).toBe("Spaghetti Carbonara");
  });

  it("uses the claude-sonnet-4-6 model", async () => {
    await POST(makeRequest({ transcript: NARRATION, source: "url" }));
    const args = mockState.lastCallArgs as { model: string };
    expect(args.model).toBe("claude-sonnet-4-6");
  });

  it("sends a system prompt that includes JSON output instructions", async () => {
    await POST(makeRequest({ transcript: NARRATION, source: "url" }));
    const args = mockState.lastCallArgs as { system: string };
    expect(args.system).toBeTruthy();
    expect(args.system).toMatch(/json/i);
  });

  it("sends the transcript as the sole user message", async () => {
    await POST(makeRequest({ transcript: NARRATION, source: "url" }));
    const args = mockState.lastCallArgs as { messages: unknown[] };
    expect(args.messages).toHaveLength(1);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("error handling", () => {
  it("returns 500 when Claude output is not valid JSON", async () => {
    mockState.responseText = "Sorry, I cannot help with that.";
    const res = await POST(makeRequest({ transcript: NARRATION, source: "url" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to parse/i);
  });

  it("returns 401 for Anthropic authentication errors", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    mockState.shouldThrow = new (
      Anthropic as unknown as { AuthenticationError: new (msg: string) => Error }
    ).AuthenticationError("Unauthorized");

    const res = await POST(makeRequest({ transcript: NARRATION, source: "url" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid api key/i);
  });

  it("returns 500 for generic errors", async () => {
    mockState.shouldThrow = new Error("Network failure");
    const res = await POST(makeRequest({ transcript: NARRATION, source: "url" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/something went wrong/i);
  });
});
