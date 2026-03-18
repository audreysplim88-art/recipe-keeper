# Backlog
## Recipe Keeper — Task Tickets

**Last updated:** 2026-03-18
Tickets are grouped by phase. Within each phase, they are ordered by priority (highest first).

---

## Phase 1 — AI Sous Chef

### SC-001 · TTS Utility
**Status:** 🔲 Planned
**File:** `lib/tts.ts`
**Description:** Build a `TTSManager` class that wraps `window.speechSynthesis`. Streams Claude text to speech as sentences complete (not waiting for full response). Handles interruption when user starts speaking, iOS silent-cutoff workaround, and voice preference selection.
**Acceptance criteria:**
- `appendText(chunk)` buffers text and speaks completed sentences immediately
- `flush()` speaks remaining buffer at end of response
- `interrupt()` cancels all speech and clears queue instantly
- iOS 15s cutoff mitigated via periodic pause/resume heartbeat
- Falls back gracefully if `speechSynthesis` unavailable

---

### SC-002 · Sous Chef API Route
**Status:** 🔲 Planned
**File:** `app/api/sous-chef/route.ts`
**Description:** Stateless multi-turn streaming Claude API. Accepts full conversation history + recipe object; returns SSE stream. System prompt injects the full recipe and behavioural rules (short responses, step tracking, tip surfacing, spoken prose only).
**Acceptance criteria:**
- Accepts `{ messages, recipe }` — recipe passed on every call (stateless)
- Returns SSE `data: {"text": "..."}` chunks + `data: [DONE]`
- `max_tokens: 300` (enforces short spoken responses)
- System prompt correctly formats ingredients, steps, tips for Claude
- Handles auth errors and API errors with clean JSON error responses

---

### SC-003 · Conversational Voice Input Component
**Status:** 🔲 Planned
**File:** `components/CookingVoiceInput.tsx`
**Description:** Voice input built for short conversational turns, not long narration. Distinct from `VoiceCapture.tsx` — activates/deactivates based on parent control, auto-sends after 2s silence, clears transcript after each send.
**Acceptance criteria:**
- Auto-activates when `isActive` prop becomes `true`
- Auto-sends and clears after 2s silence with content
- Calls `onSpeechStart` immediately when user begins speaking (for TTS interruption)
- Shows live transcript preview while speaking
- Text `<input>` fallback rendered when `SpeechRecognition` unavailable
- Reuses stale-closure prevention pattern from `VoiceCapture.tsx`

---

### SC-004 · Sous Chef Session Component
**Status:** 🔲 Planned
**File:** `components/SousChefSession.tsx`
**Description:** Main cooking session UI. Manages full conversation state, streams Claude responses, orchestrates TTS and voice input, tracks recipe step progress. Full-screen dark layout with current step, conversation log and mic area.
**Acceptance criteria:**
- Auto-starts session on mount (greets user, asks about ingredients)
- Requests mic permission early via `getUserMedia`
- Streams SSE and speaks via TTS simultaneously (sentence-by-sentence)
- User speech interrupts TTS immediately
- Step counter updates from Claude's response text
- Sliding window: sends last 10 messages to API (not full history)
- Exit button navigates back to `/recipe/[id]`
- Mobile responsive (sidebar collapses on small screens)
- Handles API errors gracefully with visible error state

---

### SC-005 · Cook Page Route
**Status:** 🔲 Planned
**File:** `app/cook/[id]/page.tsx`
**Description:** Thin client component that loads the recipe from localStorage and renders `SousChefSession`. Handles loading and not-found states.
**Acceptance criteria:**
- Loads recipe by ID from localStorage on mount
- Shows spinner during load
- Shows "Recipe not found" + back link if ID invalid
- Full-screen wrapper with no app navigation chrome

---

### SC-006 · Start Cooking Entry Point
**Status:** 🔲 Planned
**File:** `components/RecipeCard.tsx`
**Description:** Add "Start Cooking" button to the recipe card header in view mode. Links to `/cook/[id]`.
**Acceptance criteria:**
- Button visible in view mode only (not in edit mode)
- Navigates to `/cook/[id]`
- Styled consistently with existing header buttons (orange accent)

---

### SC-007 · Capture Session Auto-Save
**Status:** 🔲 Planned
**File:** `app/capture/page.tsx`
**Description:** Auto-save voice narration transcript to `sessionStorage` every 30s as a safety net against accidental page refresh/navigation during long sessions. Show a restore banner on next visit if unsaved transcript found.
**Acceptance criteria:**
- Transcript saved to `sessionStorage` every 30s if content exists
- On mount: check for backup → show dismissible "restore" banner if found
- Restore banner shows when the backup was saved
- Backup cleared on successful recipe save
- No impact on normal workflow (silent, no UI when saving)

---

## Phase 2 — Cooking Session Enhancements

### CE-001 · Cooking Timers
**Status:** 🔲 Backlog
**Description:** User can say "set a 10-minute timer" during a sous chef session. Claude detects the intent, the app starts a visual + audio countdown. On completion, AI notifies the cook.

### CE-002 · Serving-Aware Guidance
**Status:** 🔲 Backlog
**Description:** If the recipe has been scaled (via serving calculator), the sous chef references the scaled quantities ("you're cooking for 8, so use 400 grams of pasta") rather than the base amounts.

### CE-003 · Session Summary
**Status:** 🔲 Backlog
**Description:** On completing the final recipe step, show a summary screen: recipe name, how long the session took, tips reviewed, option to add notes to the recipe.

### CE-004 · Mid-Session Note Capture
**Status:** 🔲 Backlog
**Description:** User can say "add this to my secrets" during cooking. AI captures it and appends it to the recipe's tips after the session ends.

### CE-005 · Resume Interrupted Session
**Status:** 🔲 Backlog
**Description:** If the user accidentally navigates away during cooking, offer to resume from the last known step on return.

---

## Phase 3 — Recipe Intelligence

### RI-001 · Recipe Version History
**Status:** 🔲 Backlog
**Description:** Track edits to a recipe over time. Show a diff view between versions. Allow reverting.

### RI-002 · Ingredient-Based Search
**Status:** 🔲 Backlog
**Description:** "What can I make with chicken, lemon and thyme?" — searches recipe box by ingredients, not just title/description.

### RI-003 · AI-Suggested Improvements
**Status:** 🔲 Backlog
**Description:** After a cooking session, Claude reviews the conversation log and suggests additions to the recipe's tips/secrets based on what was discussed.

### RI-004 · Meal Planning
**Status:** 🔲 Backlog
**Description:** Suggest a week of dinners based on the recipe box. Generate a combined shopping list.

---

## Phase 4 — Sharing & Portability

### SP-001 · PDF Export
**Status:** 🔲 Backlog
**Description:** Export any recipe as a printable PDF recipe card (beautiful format, tips section included).

### SP-002 · JSON Backup & Restore
**Status:** 🔲 Backlog
**Description:** Export full recipe box as a JSON file. Import from a previously exported file. Essential before any cloud migration.

### SP-003 · Cloud Sync
**Status:** 🔲 Backlog
**Description:** Move recipe storage from localStorage to a backend (e.g. Supabase). Recipes survive across browsers and devices.

---

## Bug Fixes & Improvements (Ongoing)

### BUG-001 · Speech recognition network error handling
**Status:** 🔲 Planned
**Description:** Current `VoiceCapture.tsx` logs a console error on network speech errors but doesn't show meaningful UI feedback or attempt a clean recovery. Improve user-facing messaging.

### IMP-001 · Category backfill for existing recipes
**Status:** 🔲 Planned
**Description:** Existing recipes without a category should be offered a one-click AI classification (similar to allergen backfill). Add to the dashboard backfill banner.
