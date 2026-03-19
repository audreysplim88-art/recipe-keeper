# Backlog
## Recipe Keeper — Task Tickets

**Last updated:** 2026-03-19
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

## Phase 3 — Cooking Session Enhancements

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
