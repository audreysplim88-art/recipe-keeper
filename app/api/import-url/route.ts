/**
 * Fetches a recipe URL server-side (bypassing browser CORS restrictions),
 * strips the HTML down to readable text, then passes it to the generate-recipe
 * endpoint so Claude can structure it into a recipe card.
 */

const MAX_CONTENT_LENGTH = 20_000; // chars sent to Claude — enough for any recipe page

/** Strip HTML tags, scripts, styles and collapse whitespace into clean readable text. */
function extractText(html: string): string {
  return html
    // Remove script and style blocks entirely (including their content)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    // Remove nav / header / footer / sidebar noise
    .replace(/<(nav|header|footer|aside|iframe|noscript)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, " ")
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    // Collapse whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return Response.json({ error: "Please provide a URL." }, { status: 400 });
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      return Response.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return Response.json({ error: "Only http and https URLs are supported." }, { status: 400 });
    }

    // Fetch the page
    let html: string;
    try {
      const res = await fetch(parsedUrl.toString(), {
        headers: {
          // Polite browser-like user agent so most recipe sites serve content normally
          "User-Agent": "Mozilla/5.0 (compatible; RecipeKeeper/1.0; personal use)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(10_000), // 10 second timeout
      });

      if (!res.ok) {
        return Response.json(
          { error: `Could not fetch that page (status ${res.status}). Try copying and pasting the recipe text instead.` },
          { status: 422 }
        );
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        return Response.json(
          { error: "That URL doesn't appear to be a recipe page. Try copying and pasting the text instead." },
          { status: 422 }
        );
      }

      html = await res.text();
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      return Response.json(
        { error: isTimeout ? "The page took too long to load. Try pasting the recipe text instead." : "Could not reach that URL. Check it's correct and publicly accessible." },
        { status: 422 }
      );
    }

    // Extract and trim the text
    const text = extractText(html).slice(0, MAX_CONTENT_LENGTH);

    if (text.length < 100) {
      return Response.json(
        { error: "Couldn't extract readable content from that page. Try pasting the recipe text instead." },
        { status: 422 }
      );
    }

    return Response.json({ text });
  } catch (error) {
    console.error("URL import error:", error);
    return Response.json({ error: "Something went wrong fetching that URL." }, { status: 500 });
  }
}
