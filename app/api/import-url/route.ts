/**
 * Fetches a recipe URL server-side (bypassing browser CORS restrictions),
 * strips the HTML down to readable text, then passes it to the generate-recipe
 * endpoint so Claude can structure it into a recipe card.
 *
 * Instagram Reels are handled specially: the recipe lives in the post caption,
 * which Instagram embeds in the og:description meta tag even for server-side fetches.
 */

import {
  URL_MAX_CONTENT_CHARS,
  URL_FETCH_TIMEOUT_MS,
  URL_MIN_PAGE_TEXT_CHARS,
  INSTAGRAM_MIN_CAPTION_CHARS,
  URL_FETCH_USER_AGENT,
} from "@/lib/constants";
import { requireAuth } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";

// Block private/internal IP ranges to prevent SSRF attacks
const PRIVATE_HOST =
  /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1)/i;

function isInstagramUrl(url: URL): boolean {
  return url.hostname === "www.instagram.com" || url.hostname === "instagram.com";
}

/** Extract og:description (or fallback description) meta tag content from raw HTML. */
function extractMetaDescription(html: string): string {
  const patterns = [
    /<meta\s[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i,
    /<meta\s[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i,
    /<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
    /<meta\s[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
    }
  }
  return "";
}

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
  // Authentication
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  // Rate limit: 20 URL imports per 10 minutes per user
  if (!checkRateLimit(`import-url:${auth.user.id}`, 20, 10 * 60 * 1000)) {
    return Response.json(
      { error: "Too many URL imports. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

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

    // Block private/internal IP ranges (SSRF protection)
    if (PRIVATE_HOST.test(parsedUrl.hostname)) {
      return Response.json({ error: "That URL is not accessible." }, { status: 400 });
    }

    // Fetch the page
    let html: string;
    try {
      const res = await fetch(parsedUrl.toString(), {
        headers: {
          "User-Agent": URL_FETCH_USER_AGENT,
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
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

    // Instagram: caption lives in the og:description meta tag
    if (isInstagramUrl(parsedUrl)) {
      const caption = extractMetaDescription(html);
      if (!caption || caption.length < INSTAGRAM_MIN_CAPTION_CHARS) {
        return Response.json(
          { error: "Couldn't extract the caption from that Instagram Reel. Make sure the post is public, or copy the description text and use \"Paste text\" instead." },
          { status: 422 }
        );
      }
      return Response.json({ text: caption, source: "instagram" });
    }

    // Extract and trim the text
    const text = extractText(html).slice(0, URL_MAX_CONTENT_CHARS);

    if (text.length < URL_MIN_PAGE_TEXT_CHARS) {
      return Response.json(
        { error: "Couldn't extract readable content from that page. Try pasting the recipe text instead." },
        { status: 422 }
      );
    }

    return Response.json({ text, source: "url" });
  } catch (error) {
    console.error("URL import error:", error);
    return Response.json({ error: "Something went wrong fetching that URL." }, { status: 500 });
  }
}
