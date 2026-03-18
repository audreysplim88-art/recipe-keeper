/**
 * @jest-environment node
 */

/**
 * Tests for app/api/sous-chef/route.ts
 *
 * The Anthropic SDK is mocked so no real API calls are made.
 * We test:
 *  - Input validation (missing recipe, empty messages)
 *  - Successful SSE streaming response
 *  - Authentication error surfaces correctly
 *  - Generic errors are handled gracefully
 *  - Sliding-window truncation (only last 20 messages sent)
 *  - System prompt includes recipe details
 */

import { POST } from "@/app/api/sous-chef/route";
import { Recipe } from "@/lib/types";

// ─── Mock Anthropic SDK ───────────────────────────────────────────────────────

// Mutable state buckets written by each test before calling POST.
// Declared as a plain object (not let/const bindings) so they can be read
// inside the hoisted jest.mock factory without hitting the TDZ.
const mockState = {
  events: [] as Array<Record<string, unknown>>,
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
          [Symbol.asyncIterator]: async function* () {
            if (mockState.shouldThrow) throw mockState.shouldThrow;
            for (const event of mockState.events) {
              yield event;
            }
          },
        };
      },
    },
  }));
  (MockAnthropic as unknown as Record<string, unknown>).AuthenticationError = AuthenticationError;

  return { __esModule: true, default: MockAnthropic };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "recipe-1",
    title: "Spaghetti Carbonara",
    description: "A classic Roman pasta dish.",
    servings: "2 servings",
    prepTime: "10 minutes",
    cookTime: "20 minutes",
    ingredients: [
      { amount: "200g", unit: "", name: "spaghetti" },
      { amount: "100g", unit: "", name: "pancetta" },
    ],
    instructions: ["Boil pasta.", "Fry pancetta.", "Mix eggs and cheese.", "Combine everything."],
    tips: [{ category: "secret", content: "Use pasta water to loosen the sauce." }],
    dietaryTags: [],
    allergens: ["gluten", "eggs", "dairy"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// The route handler only calls request.json(), so we use a minimal stub
// rather than relying on the full Fetch API Request (not in jsdom).
function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

/** Consume a SSE ReadableStream and return all decoded text */
async function readStream(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value);
  }
  return result;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockState.events = [];
  mockState.shouldThrow = null;
  mockState.lastCallArgs = null;
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe("input validation", () => {
  it("returns 400 when recipe is missing", async () => {
    const req = makeRequest({ messages: [{ role: "user", content: "Hello" }] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/recipe is required/i);
  });

  it("returns 400 when recipe has no title", async () => {
    const req = makeRequest({
      recipe: { id: "1" },
      messages: [{ role: "user", content: "Hello" }],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/recipe is required/i);
  });

  it("returns 400 when messages array is empty", async () => {
    const req = makeRequest({ recipe: makeRecipe(), messages: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one message/i);
  });

  it("returns 400 when messages is not an array", async () => {
    const req = makeRequest({ recipe: makeRecipe(), messages: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one message/i);
  });
});

// ─── Successful streaming ─────────────────────────────────────────────────────

describe("successful streaming", () => {
  it("returns a 200 SSE response with correct headers", async () => {
    mockState.events = [
      { type: "content_block_delta", delta: { type: "text_delta", text: "Hello, chef!" } },
    ];

    const res = await POST(
      makeRequest({ recipe: makeRecipe(), messages: [{ role: "user", content: "Let's cook!" }] })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("streams text delta events and terminates with [DONE]", async () => {
    mockState.events = [
      { type: "content_block_delta", delta: { type: "text_delta", text: "Ready" } },
      { type: "content_block_delta", delta: { type: "text_delta", text: " to cook?" } },
    ];

    const res = await POST(
      makeRequest({ recipe: makeRecipe(), messages: [{ role: "user", content: "Start" }] })
    );
    const body = await readStream(res);

    expect(body).toContain('{"text":"Ready"}');
    expect(body).toContain('{"text":" to cook?"}');
    expect(body).toContain("data: [DONE]");
  });

  it("ignores non-text-delta events", async () => {
    mockState.events = [
      { type: "message_start", message: {} },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", delta: { type: "text_delta", text: "Hello." } },
      { type: "message_stop" },
    ];

    const res = await POST(
      makeRequest({ recipe: makeRecipe(), messages: [{ role: "user", content: "Hi" }] })
    );
    const body = await readStream(res);

    // Only the text delta should appear as a data event (plus [DONE])
    const dataLines = body
      .split("\n")
      .filter((l) => l.startsWith("data:") && !l.includes("[DONE]"));
    expect(dataLines).toHaveLength(1);
    expect(dataLines[0]).toContain('"text":"Hello."');
  });

  it("passes the recipe and messages to the Anthropic client", async () => {
    const recipe = makeRecipe();
    const messages = [{ role: "user" as const, content: "Let's start!" }];

    await POST(makeRequest({ recipe, messages }));

    const args = mockState.lastCallArgs as {
      model: string;
      max_tokens: number;
      system: string;
      messages: unknown[];
    };
    expect(args.model).toBe("claude-sonnet-4-6");
    expect(args.max_tokens).toBe(300);
    expect(args.messages).toEqual(messages);
    expect(args.system).toContain("Spaghetti Carbonara");
    expect(args.system).toContain("pancetta");
  });
});

// ─── Sliding window ───────────────────────────────────────────────────────────

describe("sliding window", () => {
  it("sends only the last 20 messages when conversation is longer", async () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i + 1}`,
    }));

    await POST(makeRequest({ recipe: makeRecipe(), messages }));

    const args = mockState.lastCallArgs as { messages: Array<{ content: string }> };
    expect(args.messages).toHaveLength(20);
    expect(args.messages[0].content).toBe("Message 11");
    expect(args.messages[19].content).toBe("Message 30");
  });

  it("sends all messages when conversation has 20 or fewer", async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i + 1}`,
    }));

    await POST(makeRequest({ recipe: makeRecipe(), messages }));

    const args = mockState.lastCallArgs as { messages: unknown[] };
    expect(args.messages).toHaveLength(10);
  });
});

// ─── System prompt content ────────────────────────────────────────────────────

describe("system prompt", () => {
  it("includes recipe title, servings and cook time", async () => {
    const recipe = makeRecipe({
      title: "Beef Wellington",
      servings: "4 servings",
      cookTime: "45 minutes",
    });

    await POST(makeRequest({ recipe, messages: [{ role: "user", content: "Ready!" }] }));

    const args = mockState.lastCallArgs as { system: string };
    expect(args.system).toContain("Beef Wellington");
    expect(args.system).toContain("4 servings");
    expect(args.system).toContain("45 minutes");
  });

  it("includes allergens when present", async () => {
    const recipe = makeRecipe({ allergens: ["gluten", "eggs"] });

    await POST(makeRequest({ recipe, messages: [{ role: "user", content: "Ready!" }] }));

    const args = mockState.lastCallArgs as { system: string };
    expect(args.system).toContain("gluten");
    expect(args.system).toContain("eggs");
  });

  it("includes tips and secrets", async () => {
    const recipe = makeRecipe({
      tips: [{ category: "secret", content: "Use cold butter for flakier pastry." }],
    });

    await POST(makeRequest({ recipe, messages: [{ role: "user", content: "Start cooking" }] }));

    const args = mockState.lastCallArgs as { system: string };
    expect(args.system).toContain("cold butter for flakier pastry");
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("error handling", () => {
  it("streams an error event when the Anthropic stream throws a generic error", async () => {
    mockState.shouldThrow = new Error("Network error");

    const res = await POST(
      makeRequest({ recipe: makeRecipe(), messages: [{ role: "user", content: "Hello" }] })
    );

    // SSE route returns 200 even on stream errors; the error is in the stream body
    expect(res.status).toBe(200);
    const body = await readStream(res);
    expect(body).toContain('"error"');
    expect(body).toContain("Something went wrong");
  });

  it("streams an auth error message when Anthropic throws AuthenticationError", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    mockState.shouldThrow = new (
      Anthropic as unknown as { AuthenticationError: new (msg: string) => Error }
    ).AuthenticationError("Unauthorized");

    const res = await POST(
      makeRequest({ recipe: makeRecipe(), messages: [{ role: "user", content: "Hello" }] })
    );
    const body = await readStream(res);
    expect(body).toContain("Invalid API key");
  });
});
