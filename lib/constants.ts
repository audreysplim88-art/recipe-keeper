/**
 * Central home for every tunable constant in the application.
 *
 * Keeping numbers here means:
 *  - A single place to adjust limits, timeouts, and quality settings
 *  - Tests that import these constants stay correct automatically when values change
 *  - The rationale for each value is documented alongside it
 */

// ─── Subscription / paywall ───────────────────────────────────────────────────

/** Number of recipes a free user can save before hitting the paywall. */
export const FREE_RECIPE_LIMIT = 3;



// ─── AI models ────────────────────────────────────────────────────────────────

/**
 * Model used for structured recipe generation (text and vision) and the
 * sous chef conversation. Sonnet balances quality with reasonable latency.
 */
export const RECIPE_MODEL = "claude-sonnet-4-6";

/**
 * Model used for dietary/allergen backfill classification only.
 * Haiku is used here because the task is narrow and structured — it requires
 * only a short JSON response — so the faster, cheaper model is appropriate.
 */
export const CLASSIFY_MODEL = "claude-haiku-4-5";

// ─── Token budgets ────────────────────────────────────────────────────────────

/** Max output tokens for a full recipe generation response (text or vision). */
export const RECIPE_MAX_TOKENS = 4096;

/**
 * Max output tokens for dietary/allergen classification.
 * The response is a small JSON object, so 256 is more than sufficient.
 */
export const CLASSIFY_MAX_TOKENS = 256;

/**
 * Max output tokens for a single sous chef reply.
 * Kept deliberately short — the persona is concise (2–3 sentences max)
 * and shorter responses arrive faster via the SSE stream.
 */
export const SOUS_CHEF_MAX_TOKENS = 200;

// ─── Sous chef conversation ───────────────────────────────────────────────────

/**
 * Number of most-recent messages sent to the sous chef model per request.
 * Older messages are dropped to keep context cost under control.
 * 20 messages = 10 full exchanges, which covers a typical cooking session step.
 */
export const SOUS_CHEF_CONVERSATION_WINDOW = 20;

// ─── Recipe text input ────────────────────────────────────────────────────────

/**
 * Minimum transcript length (characters) the generate-recipe API will accept.
 *
 * This is an API-level backstop — deliberately lower than CAPTURE_MIN_CONTENT_CHARS
 * so the API can be called directly (e.g. by tests or future integrations) without
 * being more restrictive than necessary. The UI applies its own, higher threshold
 * (CAPTURE_MIN_CONTENT_CHARS) before calling this endpoint, so in normal usage
 * the API guard is never the one that fires.
 */
export const MIN_TRANSCRIPT_CHARS = 10;

// ─── Capture page ─────────────────────────────────────────────────────────────

/** sessionStorage key used to persist in-progress narrations between page loads. */
export const CAPTURE_BACKUP_KEY = "capture-backup";

/** Minimum interval between sessionStorage backup writes, in milliseconds. */
export const CAPTURE_BACKUP_INTERVAL_MS = 30_000;

/**
 * Minimum content length (characters) for the capture page UI. Used for:
 *  - deciding whether a backup is worth restoring
 *  - deciding whether to write a backup at all
 *  - deciding whether the Generate / Read Photos button should be enabled
 *
 * Intentionally higher than MIN_TRANSCRIPT_CHARS (the API backstop) so the UI
 * gives meaningful early feedback before the user has typed enough for a real
 * recipe. Content between MIN_TRANSCRIPT_CHARS and this value would be accepted
 * by the API if sent directly, but the UI never sends it.
 */
export const CAPTURE_MIN_CONTENT_CHARS = 20;

// ─── Dietary/allergen backfill ────────────────────────────────────────────────

/**
 * Minimum pause between successive classify-recipe API calls during backfill.
 * Keeps request throughput at a comfortable ~3/second (well under Anthropic's
 * rate limits) and avoids hammering the endpoint when the user has many recipes.
 * The delay is skipped after the final request to finish as quickly as possible.
 */
export const BACKFILL_REQUEST_DELAY_MS = 300;

// ─── URL import ───────────────────────────────────────────────────────────────

/**
 * Maximum characters of extracted page text sent to Claude.
 * 20 000 chars is well in excess of any recipe page; truncation beyond this
 * removes boilerplate noise and saves tokens.
 */
export const URL_MAX_CONTENT_CHARS = 20_000;

/** Server-side fetch timeout for URL imports, in milliseconds. */
export const URL_FETCH_TIMEOUT_MS = 10_000;

/**
 * Minimum characters of extracted body text required before we treat a page
 * as a valid recipe source. Pages shorter than this are likely error pages.
 */
export const URL_MIN_PAGE_TEXT_CHARS = 100;

/**
 * Minimum characters of Instagram caption text required before we treat it
 * as usable recipe content. Very short captions are usually taglines, not recipes.
 */
export const INSTAGRAM_MIN_CAPTION_CHARS = 20;

/** User-Agent sent with server-side URL fetches so recipe sites serve full content. */
export const URL_FETCH_USER_AGENT =
  "Mozilla/5.0 (compatible; RecipeKeeper/1.0; personal use)";

// ─── Photo capture ────────────────────────────────────────────────────────────

/**
 * Maximum number of photos per recipe capture session.
 * Five pages covers the vast majority of multi-page cookbook recipes.
 */
export const PHOTO_MAX_COUNT = 5;

/**
 * Maximum file size (bytes) accepted per uploaded photo.
 * 20 MB is generous for any phone JPEG or screenshot (typical: 3–8 MB)
 * while blocking RAW files and accidental non-image uploads that would
 * saturate the canvas resize step.
 */
export const PHOTO_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Longest edge (pixels) images are resized to before base64-encoding.
 * 1920 px preserves enough resolution for reliable text recognition while
 * keeping the encoded payload well under Claude's image size limits.
 */
export const PHOTO_MAX_DIMENSION_PX = 1920;

/**
 * JPEG quality factor used when re-encoding images via canvas.
 * 0.85 gives excellent legibility with a significant reduction in file size
 * versus lossless or near-lossless settings.
 */
export const PHOTO_JPEG_QUALITY = 0.85;

// ─── ElevenLabs TTS ──────────────────────────────────────────────────────────

/** ElevenLabs API base URL. */
export const ELEVENLABS_API_URL = "https://api.elevenlabs.io";

/**
 * ElevenLabs voice ID.  "Eryn" — a natural, friendly voice well-suited
 * for cooking instruction.  Change this to any voice_id from your ElevenLabs
 * dashboard if you prefer a different voice.
 */
export const ELEVENLABS_VOICE_ID = "DXFkLCBUTmvXpp2QwZjA";

/** ElevenLabs model.  Multilingual v2 gives the best quality. */
export const ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";

// ─── Text-to-speech (browser fallback) ───────────────────────────────────────

/**
 * Speech rate passed to SpeechSynthesisUtterance (browser default = 1.0).
 * 0.95 is slightly slower than default, which gives the voice more room to
 * breathe and sounds more natural for cooking instructions.
 */
export const TTS_SPEECH_RATE = 0.95;

/** Pitch passed to SpeechSynthesisUtterance (1.0 = browser default). */
export const TTS_SPEECH_PITCH = 1.0;

/**
 * iOS Safari silently stops speechSynthesis after roughly 15 seconds of audio.
 * Issuing a pause/resume heartbeat at this interval resets the internal timer.
 * 10 s gives a comfortable 5 s margin before the cutoff.
 */
export const TTS_HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * Grace period (ms) before the iOS Safari utterance-completion poll begins.
 * The browser needs a moment to start playing before we can reliably check
 * whether speechSynthesis.speaking has gone false.
 */
export const TTS_END_POLL_GRACE_MS = 400;

/**
 * How often the iOS Safari utterance-completion poll fires, in milliseconds.
 * 250 ms is fine-grained enough to detect completion promptly without
 * creating noticeable overhead.
 */
export const TTS_END_POLL_INTERVAL_MS = 250;

/**
 * Browser TTS voice names in priority order.
 * Chrome ships premium neural voices that are noticeably warmer than OS defaults.
 * Enhanced macOS voices are preferred over their standard counterparts.
 *
 * `readonly` prevents accidental mutation; the array is iterated, never modified.
 */
export const TTS_PREFERRED_VOICES: readonly string[] = [
  "Google UK English Female", // Chrome desktop — warm neural voice, best overall
  "Google US English Female", // Chrome desktop fallback
  "Google UK English Male",   // Chrome desktop male option
  "Google US English",        // Older Chrome fallback
  "Samantha (Enhanced)",      // macOS/iOS neural
  "Karen (Enhanced)",         // macOS/iOS neural (Australian)
  "Moira (Enhanced)",         // macOS/iOS neural (Irish)
  "Samantha",                 // macOS/iOS standard
  "Karen",                    // macOS/iOS standard
  "Daniel",                   // macOS/iOS standard (British male)
];
