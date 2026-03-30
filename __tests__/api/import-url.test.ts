/**
 * @jest-environment node
 */

/**
 * Tests for app/api/import-url/route.ts
 *
 * global.fetch is mocked — no real HTTP requests are made.
 * We test:
 *  - Input validation (missing/invalid URL, unsupported protocol)
 *  - Instagram URL detection (www and non-www variants)
 *  - og:description extraction from Instagram HTML (both attribute orderings)
 *  - Fallback to meta name="description" when og:description is absent
 *  - HTML entity decoding in Instagram captions
 *  - Short/missing caption error with a helpful message
 *  - Regular URL text extraction and source tagging
 *  - Fetch failure modes (network error, timeout, non-200, wrong content-type)
 *  - Script/style stripping from extracted body text
 */

import { POST } from "@/app/api/import-url/route";

// ─── Mock global fetch ────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function makeResponse(
  html: string,
  status = 200,
  contentType = "text/html; charset=utf-8"
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (header: string) =>
        header.toLowerCase() === "content-type" ? contentType : null,
    },
    text: async () => html,
  };
}

// A realistic-length Instagram caption that passes the 20-char minimum
const INSTAGRAM_CAPTION =
  "Amazing pasta recipe!\n\nIngredients:\n- 200g spaghetti\n- 3 egg yolks\n- 100g pecorino\n\nSteps:\n1. Boil pasta until al dente.\n2. Mix egg yolks with cheese.\n3. Combine off the heat.\n\n#pasta #carbonara #recipe";

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe("input validation", () => {
  it("returns 400 when url is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/provide a url/i);
  });

  it("returns 400 when url is not a string", async () => {
    const res = await POST(makeRequest({ url: 42 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/provide a url/i);
  });

  it("returns 400 for a malformed URL", async () => {
    const res = await POST(makeRequest({ url: "not a url at all!!!" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/valid url/i);
  });

  it("returns 400 for a non-http/https protocol", async () => {
    // The route only uses a URL as-is when it starts with "http", so we need
    // a scheme that starts with "http" but isn't http: or https: to hit the
    // protocol guard (e.g. "httpx:").
    const res = await POST(makeRequest({ url: "httpx://example.com/recipe" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/only http/i);
  });
});

// ─── Instagram URL handling ───────────────────────────────────────────────────

describe("Instagram URL handling", () => {
  it("detects www.instagram.com URLs", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><head><meta property="og:description" content="${INSTAGRAM_CAPTION}" /></head></html>`
      )
    );
    const res = await POST(
      makeRequest({ url: "https://www.instagram.com/reel/ABC123/" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("instagram");
  });

  it("detects instagram.com (no www) URLs", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><head><meta property="og:description" content="${INSTAGRAM_CAPTION}" /></head></html>`
      )
    );
    const res = await POST(
      makeRequest({ url: "https://instagram.com/reel/ABC123/" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("instagram");
  });

  it("extracts caption from og:description (property then content)", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><head><meta property="og:description" content="${INSTAGRAM_CAPTION}" /></head></html>`
      )
    );
    const res = await POST(
      makeRequest({ url: "https://www.instagram.com/reel/ABC123/" })
    );
    const body = await res.json();
    expect(body.text).toBe(INSTAGRAM_CAPTION);
  });

  it("extracts caption from og:description (content then property)", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><head><meta content="${INSTAGRAM_CAPTION}" property="og:description" /></head></html>`
      )
    );
    const res = await POST(
      makeRequest({ url: "https://www.instagram.com/reel/ABC123/" })
    );
    const body = await res.json();
    expect(body.text).toBe(INSTAGRAM_CAPTION);
  });

  it("falls back to meta name=description when og:description is absent", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><head><meta name="description" content="${INSTAGRAM_CAPTION}" /></head></html>`
      )
    );
    const res = await POST(
      makeRequest({ url: "https://www.instagram.com/reel/ABC123/" })
    );
    const body = await res.json();
    expect(body.text).toBe(INSTAGRAM_CAPTION);
  });

  it("decodes HTML entities in the caption", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><head><meta property="og:description" content="Salt &amp; pepper &#39;n&#39; &quot;spice&quot;" /></head></html>`
      )
    );
    const res = await POST(
      makeRequest({ url: "https://www.instagram.com/reel/ABC123/" })
    );
    const body = await res.json();
    expect(body.text).toBe(`Salt & pepper 'n' "spice"`);
  });

  it("returns 422 when no caption meta tag is found (e.g. login-gated reel)", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><head><title>Log in</title></head><body><p>Log in to continue.</p></body></html>`
      )
    );
    const res = await POST(
      makeRequest({ url: "https://www.instagram.com/reel/ABC123/" })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/instagram/i);
    expect(body.error).toMatch(/paste/i);
  });

  it("returns 422 when the caption is too short to contain a recipe", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><head><meta property="og:description" content="Yummy!" /></head></html>`
      )
    );
    const res = await POST(
      makeRequest({ url: "https://www.instagram.com/reel/ABC123/" })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/instagram/i);
  });

  it("does NOT return source: url for Instagram URLs", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><head><meta property="og:description" content="${INSTAGRAM_CAPTION}" /></head></html>`
      )
    );
    const res = await POST(
      makeRequest({ url: "https://www.instagram.com/reel/ABC123/" })
    );
    const body = await res.json();
    expect(body.source).not.toBe("url");
  });
});

// ─── Regular URL handling ─────────────────────────────────────────────────────

describe("regular URL handling", () => {
  const RECIPE_HTML = `<html><body>
    <h1>Chocolate Cake</h1>
    <p>Mix 200g flour, 150g sugar and 50g cocoa. Whisk in 2 eggs and 200ml milk.
    Pour into a greased tin and bake at 180°C for 30 minutes. A simple and
    delicious recipe that everyone will love. Let cool before slicing.</p>
  </body></html>`;

  it("fetches a page and returns extracted text with source: url", async () => {
    mockFetch.mockResolvedValue(makeResponse(RECIPE_HTML));
    const res = await POST(
      makeRequest({ url: "https://example.com/chocolate-cake" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("url");
    expect(body.text).toContain("Chocolate Cake");
    expect(body.text).toContain("flour");
  });

  it("prepends https:// when the URL has no protocol", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(`<html><body><p>${"Recipe content. ".repeat(20)}</p></body></html>`)
    );
    await POST(makeRequest({ url: "example.com/recipe" }));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("https://"),
      expect.anything()
    );
  });

  it("returns 422 when the page returns a non-200 status", async () => {
    mockFetch.mockResolvedValue(makeResponse("", 404, "text/html"));
    const res = await POST(
      makeRequest({ url: "https://example.com/not-found" })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/404/);
  });

  it("returns 422 when content-type is not html or plain text", async () => {
    mockFetch.mockResolvedValue(makeResponse("{}", 200, "application/json"));
    const res = await POST(makeRequest({ url: "https://example.com/api" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/recipe page/i);
  });

  it("accepts text/plain content-type", async () => {
    mockFetch.mockResolvedValue(
      makeResponse("Flour, eggs, butter. Mix and bake. ".repeat(10), 200, "text/plain")
    );
    const res = await POST(
      makeRequest({ url: "https://example.com/recipe.txt" })
    );
    expect(res.status).toBe(200);
  });

  it("returns 422 when extracted text is too short", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(`<html><body><p>Too short</p></body></html>`)
    );
    const res = await POST(makeRequest({ url: "https://example.com/empty" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/couldn't extract/i);
  });

  it("returns 422 on a network error", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/could not reach/i);
  });

  it("returns 422 with a timeout-specific message when fetch times out", async () => {
    const timeoutError = new Error("Timeout");
    timeoutError.name = "TimeoutError";
    mockFetch.mockRejectedValue(timeoutError);
    const res = await POST(makeRequest({ url: "https://example.com/slow" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/too long/i);
  });

  it("strips <script> content from extracted text", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><body><script>alert('xss')</script><p>${"Recipe content here. ".repeat(10)}</p></body></html>`
      )
    );
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    const body = await res.json();
    expect(body.text).not.toContain("alert");
    expect(body.text).not.toContain("xss");
  });

  it("strips <style> content from extracted text", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        `<html><head><style>body { color: red; font-size: 16px; }</style></head><body><p>${"Recipe content here. ".repeat(10)}</p></body></html>`
      )
    );
    const res = await POST(makeRequest({ url: "https://example.com/recipe" }));
    const body = await res.json();
    expect(body.text).not.toContain("color: red");
    expect(body.text).not.toContain("font-size");
  });
});
