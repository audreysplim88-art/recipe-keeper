# Backlog
## Recipe Keeper — Task Tickets

**Last updated:** 2026-03-30
Tickets are grouped by phase. Within each phase, ordered by priority (highest first).

---

## Engineering Standards (every ticket)

Before marking any ticket complete:
- [ ] Feature works end-to-end in the browser
- [ ] New tests written for any new code paths
- [ ] `npm test` passes (all green)
- [ ] Changes committed to git with a descriptive message
- [ ] `docs/TESTING.md` updated if new test files were added
- [ ] **Data loss check:** If the ticket touches any page or component where a user creates or edits data, verify that `useUnsavedChangesWarning(isDirty)` is active for the relevant dirty state. Both browser-level navigation (refresh, tab close) and in-app navigation must be guarded.

---

## Phase 1 — AI Sous Chef ✅ All Shipped

### SC-001 · TTS Utility ✅
**File:** `lib/tts.ts`
**Description:** `TTSManager` class wrapping `window.speechSynthesis`. Streams Claude text to speech as sentences complete. Handles interruption, iOS cutoff workaround, voice preference.

### SC-002 · Sous Chef API Route ✅
**File:** `app/api/sous-chef/route.ts`
**Description:** Stateless multi-turn streaming Claude API. Accepts conversation history + recipe; returns SSE stream. Dynamic system prompt, `max_tokens: 300`, sliding window of 20 messages.

### SC-003 · Conversational Voice Input Component ✅
**File:** `components/CookingVoiceInput.tsx`
**Description:** Voice input for short turns. Activates/deactivates via `isActive`, auto-sends after 2s silence, calls `onSpeechStart` immediately on user speech, text fallback for non-Chrome.

### SC-004 · Sous Chef Session Component ✅
**File:** `components/SousChefSession.tsx`
**Description:** Main cooking session UI. Full conversation state, TTS orchestration, step tracking, full-screen dark layout.

### SC-005 · Cook Page Route ✅
**File:** `app/cook/[id]/page.tsx`
**Description:** Thin client loading recipe from localStorage. Spinner, 404 state, full-screen session wrapper.

### SC-006 · Start Cooking Entry Point ✅
**File:** `components/RecipeCard.tsx`
**Description:** "Start Cooking" button in recipe card header (view mode only).

### SC-007 · Capture Session Auto-Save ✅
**File:** `app/capture/page.tsx`
**Description:** sessionStorage auto-save every 30s; restore banner on return; cleared on successful save.

---

## Phase 2 — Voice Quality & Mobile (Current)

### VQ-001 · Natural TTS Voice
**Status:** 🔄 In Progress
**File:** `app/api/sous-chef/route.ts`
**Description:** Update the PERSONA block in `buildSystemPrompt()` to ban opening filler phrases and enforce direct, warm responses. Reduce `max_tokens` 300 → 200.
**Acceptance criteria:**
- No response begins with "Great!", "Of course!", "Absolutely!", "Sure!", "Certainly!", "Happy to help!", "Sounds good!", or "Perfect!"
- Every response's first word directly addresses the question or the next action
- 1–2 sentences for confirmations; 2–3 for multi-part instructions
- Updated tests in `__tests__/api/sous-chef.test.ts` pass

---

### VQ-002 · Hello Chef Session Start
**Status:** 🔄 In Progress
**File:** `components/SousChefSession.tsx`
**Description:** Replace the automatic session start (AI speaks on page load) with a user-initiated "waiting" phase. Cook says "Hello Chef" or taps a button to begin. Eliminates confusion between AI output and accidental user input at session start.
**Acceptance criteria:**
- On `/cook/[id]` load: AI is silent; "Ready to cook?" waiting screen shown with recipe name
- Mic is active during waiting but only wake phrases trigger session start
- Wake phrases: `hello chef`, `hey chef`, `hi chef`, `start`, `begin`, `let's go`, `let's cook`, `let's start`, `ready`
- Non-matching speech is silently ignored (no false triggers from background noise)
- Large "Start Cooking" button also starts the session
- First user message is the wake phrase itself (natural conversation opening)
- Updated tests in `__tests__/components/SousChefSession.test.tsx` pass
- **Future-proofing:** Wake-phrase logic in isolated `handleBegin()` function, replaceable with Porcupine/Whisper without touching session UI

---

### MOB-001 · iOS Safe Area Insets
**Status:** 🔄 In Progress
**Files:** `components/SousChefSession.tsx`, `app/layout.tsx`
**Description:** Bottom mic area and top bar must clear the iPhone home indicator and status bar when `viewport-fit=cover` is active. Prevents UI from being hidden behind hardware features.
**Acceptance criteria:**
- `app/layout.tsx` exports `viewport` with `viewportFit: 'cover'`
- Bottom mic bar uses `max(1.5rem, env(safe-area-inset-bottom))` for padding-bottom
- Top bar uses `max(0.75rem, env(safe-area-inset-top))` for padding-top
- Tested on iPhone Safari: no UI hidden behind home indicator or status bar

---

### MOB-002 · Mobile Recipe Steps Drawer
**Status:** 🔄 In Progress
**File:** `components/SousChefSession.tsx`
**Description:** The recipe step sidebar is `hidden lg:flex` — invisible on mobile. Add a "Steps" toggle button in the top bar (mobile only) that opens a full-screen overlay showing all steps with current step highlighted.
**Acceptance criteria:**
- "Steps" button visible in top bar on mobile (`lg:hidden`)
- Tapping shows a fixed overlay panel below the top bar with all steps listed
- Current step highlighted in amber; completed steps show a checkmark
- Tapping outside or the "Steps" button again closes the overlay
- Desktop sidebar (`hidden lg:flex`) unchanged
- **Future-proofing:** Visual-only design (non-voice-dependent), compatible with future haptic feedback additions

---

### MOB-003 · Touch Target Sizing
**Status:** 🔄 In Progress
**File:** `components/SousChefSession.tsx`
**Description:** All interactive elements must meet the iOS Human Interface Guideline minimum of 44×44px.
**Acceptance criteria:**
- Exit button tap area ≥ 44×44px (use negative margin to expand without visual change)
- Steps toggle button tap area ≥ 44×44px
- "Start Cooking" waiting screen CTA is already large — verify and keep
- Waiting screen button tap area ≥ 44×44px

---

## Phase 2.5 — UI Polish: Gastronom First Iteration

### UI-EPIC-001 · Gastronom UI Polish — First Iteration
**Goal:** Rebrand the app as Gastronom, clean up emoji/icon usage, tighten copy across all screens, add recipe filtering, and polish the sous chef experience.

---

### UI-001 · Dashboard rebrand + category filter
**Status:** 🔲 Backlog
**File:** `app/page.tsx`
**Description:** Rename the app to "Gastronom", update the subtitle and "+ New Recipe" button, and add a category filter pill bar to the dashboard.
**Acceptance criteria:**
- Header reads "Gastronom" with subtitle "Your favourite recipes and chef tips and tricks, all in one place"
- Button reads "+ New Recipe" with no emoji
- Category filter pills appear when ≥1 recipe exists; only populated categories shown
- Selecting a category shows only that section; "All" shows everything
- Filter is independent from search; empty state unaffected

---

### UI-002 · Compact recipe grid cards
**Status:** 🔲 Backlog
**File:** `app/page.tsx` (`RecipeListCard` component)
**Description:** Remove the description paragraph, secrets count, and garlic emoji from recipe grid cards to make them more compact and scannable.
**Acceptance criteria:**
- Cards show: category pill + badges → title → `N ingredients · date`
- No description text, no secrets count, no garlic emoji
- Category pill, allergen badge, dietary badges, and date all retained

---

### UI-003 · "+ New Recipe" interface — copy refresh & emoji removal
**Status:** 🔲 Backlog
**Files:** `app/capture/page.tsx`, `components/VoiceCapture.tsx`
**Description:** Remove all emoji from tab buttons and generate buttons; rewrite all 4 hint blocks (Narrate, Paste, URL, Photo); update textarea placeholders; replace "Claude" with "I" throughout.
**Acceptance criteria:**
- No emoji in any tab button, generate button, or voice input button
- All 4 hint headings and body texts updated per spec
- Textarea placeholders updated (narrate + paste)
- "Claude" replaced with "I" throughout the capture interface

---

### UI-004 · Recipe detail header — description, buttons, entry point
**Status:** 🔲 Backlog
**Files:** `components/RecipeCard.tsx`, `lib/prompts.ts`
**Description:** Cap the description to 2 lines in the header; update AI prompt to generate concise single-sentence descriptions; rename "Start Cooking" to "Sous Chef Mode" and remove emoji; replace ✏️ and 🗑 emoji buttons with "Edit" and "Delete" text buttons.
**Acceptance criteria:**
- Description in header is ≤2 lines; new recipes generate concise descriptions
- Button reads "Sous Chef Mode" with no emoji
- "Edit" and "Delete" text buttons visible in header; no emoji

---

### UI-005 · Sous Chef waiting screen redesign
**Status:** 🔲 Backlog
**File:** `components/SousChefSession.tsx`
**Description:** Remove chef emojis from the waiting screen; add a Gastronom Sous Chef description paragraph between the recipe title and the "Say Hello Chef" cue.
**Acceptance criteria:**
- No chef emoji anywhere on the waiting screen
- Description paragraph: "No more sauce stains on your beautiful recipe books or cards…" visible between recipe title and cue
- Layout order: heading → recipe title → description → cue → button

---

### UI-006 · Sous Chef concise opening message
**Status:** 🔲 Backlog
**File:** `app/api/sous-chef/route.ts`
**Description:** Shorten the AI's first message to a single sentence: "Hello, chef! I'm ready to guide you through making [recipe title]. Ready when you are."
**Acceptance criteria:**
- First AI message is a single short sentence naming the recipe
- No "do you have all your ingredients ready?" in the opener
- Subsequent messages follow all existing PERSONA rules

---

## Phase 3 — Performance & Cooking Session Enhancements

> Performance tickets (PERF-001, PERF-002) are highest priority. Latency issues identified from real use should be resolved before new session features are added.

### PERF-001 · Wake Phrase Response Time
**Status:** 🔲 Backlog
**Files:** `components/CookingVoiceInput.tsx`, `components/SousChefSession.tsx`
**Description:** Saying "Hello Chef" currently takes 1–3 seconds to trigger the session start. Root cause: `CookingVoiceInput` only calls `onSend` on *final* Web Speech API results, which arrive in batches. The wake phrase regex in `SousChefSession` therefore doesn't run until the full utterance is finalised. Fix: pass interim results to a lightweight wake phrase check and call `handleBegin()` the moment the phrase is recognisable — without waiting for the final result.
**Acceptance criteria:**
- Session begins within 500ms of the wake phrase being spoken (measured from start of phrase to session state change)
- False positive rate is negligible — only confident interim matches trigger (phrase is ≥2 words and matches pattern)
- `handleBegin()` remains the single integration point (future Porcupine/Whisper replacement is not affected)
- Updated tests in `__tests__/components/SousChefSession.test.tsx` and `__tests__/components/CookingVoiceInput.test.tsx` pass
- **Future-proofing:** This is a short-term fix. MU-003 (native wake word via Porcupine) is the long-term solution and will replace this entirely via `handleBegin()`.

---

### PERF-002 · AI Response Latency
**Status:** 🔲 Backlog
**Files:** `app/api/sous-chef/route.ts`, `lib/tts.ts`, `components/SousChefSession.tsx`
**Description:** Variable latency (up to 3–4s before first spoken word) breaks the cooking flow when something is on the heat. Three optimisations in priority order: (1) an immediate "thinking" cue fires the moment the mic deactivates so silence feels intentional; (2) move `/api/sous-chef` to Next.js Edge Runtime to eliminate cold-start overhead on serverless functions; (3) lower `TTSManager`'s sentence-assembly threshold so speech begins on the first complete clause, not only on a full-sentence boundary.
**Acceptance criteria:**
- Immediate visual or audio feedback (e.g. pulsing mic indicator) fires within 100ms of the user stopping speaking
- `/api/sous-chef` runs on Edge Runtime (`export const runtime = 'edge'`); SSE streaming verified working
- `TTSManager` begins speaking on the first phrase ≥3 words that ends with a comma, colon, or sentence-ending punctuation — not only full stops
- First spoken word from AI within 1.5s of user finishing (95th percentile, good network conditions)
- All existing tests pass; new behaviour covered in `__tests__/lib/tts.test.ts`
- **Longer-term:** Evaluate streamed TTS APIs (ElevenLabs, OpenAI TTS) that synthesise audio in parallel with Claude token streaming. Evaluate routing short confirmations to a faster/cheaper model tier.

---

### CE-001 · Cooking Timers
**Status:** 🔲 Backlog
**Description:** User can say "set a 10-minute timer" during a sous chef session. Claude detects the intent, the app starts a visual + audio countdown. On completion, AI notifies the cook.

### CE-002 · Serving-Aware Guidance
**Status:** 🔲 Backlog
**Description:** If the recipe has been scaled, the sous chef references scaled quantities ("you're cooking for 8, so use 400g of pasta") rather than base amounts.

### CE-003 · Session Summary
**Status:** 🔲 Backlog
**Description:** On completing the final step, show a summary screen: recipe name, session duration, tips reviewed, option to add notes.

### CE-004 · Mid-Session Note Capture
**Status:** 🔲 Backlog
**Description:** User can say "add this to my secrets" during cooking. AI captures it and appends to recipe tips after the session ends.

### CE-005 · Resume Interrupted Session
**Status:** 🔲 Backlog
**Description:** If user navigates away mid-cook, offer to resume from the last known step on return.

---

## Phase 4 — Recipe Intelligence

### RI-001 · Recipe Version History
**Status:** 🔲 Backlog
**Description:** Track edits to a recipe over time. Diff view between versions. Allow reverting.

### RI-002 · Ingredient-Based Search
**Status:** 🔲 Backlog
**Description:** "What can I make with chicken, lemon and thyme?" — searches by ingredients, not just title/description.

### RI-003 · AI-Suggested Improvements
**Status:** 🔲 Backlog
**Description:** After a cooking session, Claude reviews the conversation log and suggests additions to tips/secrets.

### RI-004 · Meal Planning
**Status:** 🔲 Backlog
**Description:** Suggest a week of dinners from the recipe box. Generate a combined shopping list.

---

## Phase 5 — Sharing & Portability

### SP-001 · PDF Export
**Status:** 🔲 Backlog
**Description:** Export any recipe as a printable PDF card (beautiful format, tips section included).

### SP-002 · JSON Backup & Restore
**Status:** 🔲 Backlog
**Description:** Export full recipe box as JSON. Import from a previously exported file.

### SP-003 · Cloud Sync
**Status:** 🔲 Backlog
**Description:** Move recipe storage from localStorage to a backend (e.g. Supabase). Recipes survive across browsers and devices.

---

## Phase 6 — Multi-User, Noise Resilience & Accessibility

> These are out of scope for v1–v2 but architecture decisions in Phases 1–2 are intentionally forward-compatible. See PRD-v2.md §7.

### MU-001 · Multi-User Session Architecture (Research Spike)
**Status:** 🔲 Backlog
**Description:** Investigate how to support multiple participants in one cooking session (couples, families, friends in the same kitchen). Evaluate: shared conversation state, turn-taking model, speaker identification. Deliverable: architecture ADR.

### MU-002 · Noise-Robust STT Evaluation
**Status:** 🔲 Backlog
**Description:** Evaluate Whisper API, Deepgram, and Porcupine as replacements/complements to Web Speech API in noisy kitchen environments (extraction fans, sizzling, multiple speakers). Deliverable: benchmark report + recommendation.
**Note:** `CookingVoiceInput.tsx` is designed with a clean `onSend`/`onSpeechStart` interface to make this replacement non-breaking.

### MU-003 · Native Wake Word ("Hey Chef")
**Status:** 🔲 Backlog
**Description:** Implement always-on wake word detection using Porcupine or equivalent library. Replaces the regex-based `handleBegin()` pattern from VQ-002 with a noise-robust, always-listening alternative.
**Note:** `handleBegin()` in `SousChefSession.tsx` is designed as the single integration point for this upgrade.

### MU-004 · Haptic Feedback for Noisy Environments
**Status:** 🔲 Backlog
**Description:** Use `navigator.vibrate()` to provide haptic cues (step change, session start/end) as a complement to voice in loud kitchens.

### MU-005 · Accessibility
**Status:** 🔲 Backlog
**Description:** Screen reader support for the cooking session UI. High-contrast mode. Larger text option. All interactive elements with proper ARIA labels.

### MU-006 · Multi-Language Support
**Status:** 🔲 Backlog
**Description:** TTS and STT in French, Spanish, Italian etc. Claude system prompt and session in the user's preferred language.

### MU-007 · Progressive Web App
**Status:** 🔲 Backlog
**Description:** Make Recipe Keeper installable on home screen (iOS and Android). Service worker for offline recipe access (no sous chef without network).

---

## Phase 7 — Accounts & Sync

### AC-001 · User Accounts
**Status:** 🔲 Backlog
**Description:** Sign-up / login. Auth provider TBD (Supabase Auth, Clerk, etc.).

### AC-002 · Cloud Recipe Storage
**Status:** 🔲 Backlog
**Description:** Migrate recipes from localStorage to a cloud database. Recipes survive across browsers and devices.

### AC-003 · Cross-Device Sync
**Status:** 🔲 Backlog
**Description:** Changes on one device reflected on all others in near-real time.

### AC-004 · Shared Recipe Collections
**Status:** 🔲 Backlog
**Description:** Family recipe box — multiple users sharing and contributing to the same collection.

---

## Bug Fixes & Improvements (Ongoing)

### BUG-001 · Speech Recognition Network Error Handling
**Status:** 🔲 Planned
**Description:** `VoiceCapture.tsx` logs a console error on network speech errors but doesn't show meaningful UI or attempt clean recovery.

### IMP-001 · Category Backfill for Existing Recipes
**Status:** 🔲 Planned
**Description:** Existing recipes without a category should be offered AI classification via the dashboard backfill banner.
