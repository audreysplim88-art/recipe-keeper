# Product Requirements Document
## Recipe Keeper — AI Sous Chef

**Version:** 1.0
**Last updated:** 2026-03-18
**Status:** In development

---

## 1. Overview

Recipe Keeper is a personal recipe management tool that captures recipes the way people actually cook — with all the tips, tricks and secrets that never make it into a standard written recipe. The product is evolving into an AI-powered cooking companion: an always-available sous chef that guides users through their own saved recipes in real-time.

---

## 2. Problem Statement

Home cooks face two distinct problems:

1. **Recipe knowledge is lost over time.** Family recipes, personal techniques and hard-won cooking secrets live in people's heads. Existing recipe tools only capture ingredients and steps — they miss the tacit knowledge that makes a dish actually work.

2. **Cooking is a hands-busy, attention-split activity.** When following a recipe mid-cook, it's disruptive to stop, read ahead, and re-orient. A proactive assistant that knows the recipe and talks to the cook is far more useful than a static page.

---

## 3. Target User

- Home cooks who cook regularly and have accumulated personal techniques
- Anyone wanting to preserve family or inherited recipes with their full context
- Cooks who want guidance and coaching while cooking, not just a reference document

---

## 4. Core Features

### 4.1 Recipe Capture (Shipped)
- **Voice narration:** Dictate a recipe while cooking; AI structures it automatically
- **Paste/type:** Paste from any source (old notes, websites, books)
- **URL import:** Paste a recipe URL and import it directly
- **Instagram Reel import:** Paste an Instagram Reel (or post) URL; the recipe is extracted from the post caption via the `og:description` meta tag and passed to Claude with Reel-aware context (hashtags and @mentions stripped, estimates made for any missing quantities or timing)
- **Photo capture:** Take up to 5 photos using the device camera, or upload images from the camera roll; Claude reads across all pages using vision and builds the recipe card (supports cookbook pages, recipe cards, handwritten notes, magazine cuttings)
- All modes extract: ingredients, steps, tips, tricks, secrets and notes

#### URL Import — Technical Notes

| Source | Detection | Extraction method | Claude source hint |
|---|---|---|---|
| Regular recipe site | Any non-Instagram URL | Server-side HTML fetch → body text stripped of scripts/styles/nav | `url` |
| Instagram Reel / Post | `instagram.com` or `www.instagram.com` hostname | `og:description` meta tag (caption embedded in page `<head>`) | `instagram` |

Instagram posts must be **public** for the `og:description` tag to contain the caption. Private posts or accounts that block server-side fetches will return an error prompting the user to copy-paste the description instead.

#### Photo Capture — Technical Notes

- Images are resized client-side via `<canvas>` to a maximum of 1920 px on the longest edge at JPEG quality 0.85 before being base64-encoded and sent to the API. This keeps payloads lean while preserving enough resolution for reliable OCR.
- The device camera is accessed via `navigator.mediaDevices.getUserMedia` with `facingMode: "environment"` (rear camera preferred). If that constraint is over-constrained (e.g. desktop with only a front camera), the request retries with unconstrained video.
- File uploads accept JPEG, PNG, WebP and GIF; all are re-encoded as JPEG after canvas resize.
- All images are sent in a single Claude vision request (`claude-sonnet-4-6`). The user message content is an array of image blocks followed by a text block that tells Claude how many pages to expect and that they may span multiple pages.
- **Known limitation:** EXIF orientation metadata (written by mobile cameras) is not corrected before canvas drawing, so portrait photos taken on some devices may render rotated in thumbnails. This does not affect recipe extraction quality.

### 4.2 Recipe Management (Shipped)
- Recipe Box dashboard with search and category sections
- Categories: Starters, Mains, Desserts, Sides, Soups & Salads, Breakfast, Snacks, Drinks, Sauces, Other
- Dietary tags: VE (Vegan), V (Vegetarian), GF (Gluten-free), DF (Dairy-free), NF (Nut-free)
- Allergen detection: EU/UK Big 14 allergens
- Serving size calculator with live ingredient scaling
- Full inline edit mode per recipe
- Auto-classification of new recipes by Claude

### 4.3 AI Sous Chef (In Development — Phase 1)
- Launch a real-time cooking session from any saved recipe
- AI guides through the recipe step by step via voice conversation
- AI proactively surfaces tips and secrets at the relevant moment (not all upfront)
- User can ask questions mid-cook; AI answers and returns to the recipe
- Hands-free: voice input with auto-send on 2s silence + TTS output
- Session lives on a dedicated full-screen cooking page (`/cook/[id]`)

---

## 5. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Voice narration session length | Support 30–40 min sessions via Web Speech API auto-restart |
| Sous chef response latency | First spoken word within ~2s of user finishing their utterance |
| Offline support | Not required (Claude API needs network) |
| Browser support | Chrome/Edge (primary); Firefox/Safari (text fallback for voice) |
| Data storage | Browser localStorage (no server-side user data) |
| API costs | Claude API credits; user provides their own API key |

---

## 6. Out of Scope (v1)

- Wake word detection ("Hey Chef")
- In-session timers / alerts
- Mid-session recipe editing
- Session persistence / resume after page close
- Multi-language support
- Nutritional information
- Social sharing / export
- Mobile app (web only)
- User accounts / cloud sync

---

## 7. Success Criteria

- User can narrate a 30-minute recipe session without data loss
- Generated recipes correctly capture tips and secrets, not just steps
- Sous chef sessions feel natural and helpful — not robotic or overwhelming
- Allergen and dietary tags are accurate on auto-detection
- Recipe cards are readable and usable during cooking (serving calculator, clear layout)
