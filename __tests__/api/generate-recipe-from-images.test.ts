/**
 * @jest-environment node
 */

/**
 * Tests for app/api/generate-recipe-from-images/route.ts
 *
 * The Anthropic SDK is mocked — no real API calls are made.
 * We test:
 *  - Input validation (missing images, empty array, too many, bad base64, bad mediaType)
 *  - Claude receives the correct content structure (image blocks then text block)
 *  - Single-image vs multi-image prompt text varies appropriately
 *  - Successful recipe parsing and response shape
 *  - Markdown code-fence stripping before JSON parse
 *  - Authentication error (401) and generic error (500) handling
 */

// ─── Mock auth & rate limiting ───────────────────────────────────────────────
jest.mock("@/lib/api-auth", () => ({
  requireAuth: jest.fn().mockResolvedValue({ user: { id: "test-user-id" } }),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
}));

import { POST } from "@/app/api/generate-recipe-from-images/route";
import { PHOTO_MAX_COUNT } from "@/lib/constants";

// ─── Mock Anthropic SDK ───────────────────────────────────────────────────────

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

// A short but valid-looking base64 string (actual content doesn't matter since
// we mock Claude — it never sees the bytes)
const FAKE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function makeImage(overrides?: Partial<{ base64: string; mediaType: string }>) {
  return { base64: FAKE_BASE64, mediaType: "image/jpeg", ...overrides };
}

const VALID_RECIPE_JSON = JSON.stringify({
  title: "Lemon Drizzle Cake",
  description: "A classic British teatime favourite.",
  category: "desserts",
  dietaryTags: ["vegetarian"],
  allergens: ["gluten", "eggs", "dairy"],
  servings: "8 slices",
  prepTime: "15 minutes",
  cookTime: "45 minutes",
  ingredients: [
    { amount: "225g", unit: "", name: "self-raising flour", notes: null },
    { amount: "225g", unit: "", name: "butter", notes: "softened" },
  ],
  instructions: [
    "Preheat oven to 180°C.",
    "Beat butter and sugar until pale.",
    "Fold in flour and lemon zest.",
    "Bake for 45 minutes.",
  ],
  tips: [{ category: "tip", content: "Poke holes while still warm so the syrup soaks right in." }],
});

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockState.responseText = VALID_RECIPE_JSON;
  mockState.shouldThrow = null;
  mockState.lastCallArgs = null;
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe("input validation", () => {
  it("returns 400 when images is missing from the body", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one photo/i);
  });

  it("returns 400 when images is not an array", async () => {
    const res = await POST(makeRequest({ images: "not-an-array" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one photo/i);
  });

  it("returns 400 when images array is empty", async () => {
    const res = await POST(makeRequest({ images: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one photo/i);
  });

  it("returns 400 when more than PHOTO_MAX_COUNT images are provided", async () => {
    const images = Array.from({ length: PHOTO_MAX_COUNT + 1 }, () => makeImage());
    const res = await POST(makeRequest({ images }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(new RegExp(`at most ${PHOTO_MAX_COUNT}`, "i"));
  });

  it("returns 400 when an image is missing its base64 data", async () => {
    const res = await POST(makeRequest({ images: [makeImage({ base64: "" })] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/photo 1.*missing/i);
  });

  it("returns 400 when an image has an unsupported mediaType", async () => {
    const res = await POST(makeRequest({ images: [makeImage({ mediaType: "image/bmp" })] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unsupported format/i);
  });

  it("accepts all four supported media types", async () => {
    for (const mediaType of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      const res = await POST(makeRequest({ images: [makeImage({ mediaType })] }));
      expect(res.status).toBe(200);
    }
  });

  it("reports the correct photo number in the error when a later image is invalid", async () => {
    const images = [makeImage(), makeImage(), makeImage({ base64: "" })];
    const res = await POST(makeRequest({ images }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/photo 3/i);
  });
});

// ─── Claude content structure ─────────────────────────────────────────────────

describe("Claude content structure", () => {
  type ContentBlock =
    | { type: "image"; source: { type: string; media_type: string; data: string } }
    | { type: "text"; text: string };

  function getContent(): ContentBlock[] {
    const args = mockState.lastCallArgs as {
      messages: Array<{ role: string; content: ContentBlock[] }>;
    };
    return args.messages[0].content;
  }

  it("sends image blocks before the text block", async () => {
    const images = [makeImage(), makeImage()];
    await POST(makeRequest({ images }));
    const content = getContent();
    expect(content[0].type).toBe("image");
    expect(content[1].type).toBe("image");
    expect(content[2].type).toBe("text");
  });

  it("sends one image block per photo", async () => {
    const images = [makeImage(), makeImage(), makeImage()];
    await POST(makeRequest({ images }));
    const content = getContent();
    const imageBlocks = content.filter((b) => b.type === "image");
    expect(imageBlocks).toHaveLength(3);
  });

  it("sets the correct base64 data on each image block", async () => {
    await POST(makeRequest({ images: [makeImage()] }));
    const content = getContent();
    const imgBlock = content[0] as Extract<ContentBlock, { type: "image" }>;
    expect(imgBlock.source.data).toBe(FAKE_BASE64);
    expect(imgBlock.source.type).toBe("base64");
    expect(imgBlock.source.media_type).toBe("image/jpeg");
  });

  it("uses singular prompt text for a single image", async () => {
    await POST(makeRequest({ images: [makeImage()] }));
    const content = getContent();
    const textBlock = content.at(-1) as Extract<ContentBlock, { type: "text" }>;
    expect(textBlock.text).toMatch(/a photo/i);
    expect(textBlock.text).not.toMatch(/multiple pages/i);
  });

  it("uses multi-page prompt text for multiple images", async () => {
    const images = [makeImage(), makeImage(), makeImage()];
    await POST(makeRequest({ images }));
    const content = getContent();
    const textBlock = content.at(-1) as Extract<ContentBlock, { type: "text" }>;
    expect(textBlock.text).toMatch(/3 photos/i);
    expect(textBlock.text).toMatch(/multiple pages/i);
  });

  it("sends only one user message", async () => {
    await POST(makeRequest({ images: [makeImage()] }));
    const args = mockState.lastCallArgs as { messages: unknown[] };
    expect(args.messages).toHaveLength(1);
  });

  it("uses the claude-sonnet-4-6 model", async () => {
    await POST(makeRequest({ images: [makeImage()] }));
    const args = mockState.lastCallArgs as { model: string };
    expect(args.model).toBe("claude-sonnet-4-6");
  });

  it("includes a system prompt that references photographs", async () => {
    await POST(makeRequest({ images: [makeImage()] }));
    const args = mockState.lastCallArgs as { system: string };
    expect(args.system).toMatch(/photograph/i);
  });
});

// ─── Successful generation ────────────────────────────────────────────────────

describe("successful generation", () => {
  it("returns 200 with the parsed recipe", async () => {
    const res = await POST(makeRequest({ images: [makeImage()] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipe.title).toBe("Lemon Drizzle Cake");
    expect(body.recipe.ingredients).toHaveLength(2);
    expect(body.recipe.instructions).toHaveLength(4);
    expect(body.recipe.tips).toHaveLength(1);
  });

  it("works with the maximum of 5 images", async () => {
    const images = Array.from({ length: 5 }, () => makeImage());
    const res = await POST(makeRequest({ images }));
    expect(res.status).toBe(200);
  });

  it("strips markdown code fences from Claude output before parsing", async () => {
    mockState.responseText = `\`\`\`json\n${VALID_RECIPE_JSON}\n\`\`\``;
    const res = await POST(makeRequest({ images: [makeImage()] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipe.title).toBe("Lemon Drizzle Cake");
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("error handling", () => {
  it("returns 500 when Claude output is not valid JSON", async () => {
    mockState.responseText = "I cannot read this image clearly.";
    const res = await POST(makeRequest({ images: [makeImage()] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/failed to parse/i);
  });

  it("returns 401 for Anthropic authentication errors", async () => {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    mockState.shouldThrow = new (
      Anthropic as unknown as { AuthenticationError: new (msg: string) => Error }
    ).AuthenticationError("Unauthorized");

    const res = await POST(makeRequest({ images: [makeImage()] }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid api key/i);
  });

  it("returns 500 for generic errors", async () => {
    mockState.shouldThrow = new Error("Network failure");
    const res = await POST(makeRequest({ images: [makeImage()] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/something went wrong/i);
  });
});
