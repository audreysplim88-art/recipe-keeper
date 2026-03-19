# Product Requirements Document
## Recipe Keeper — AI Sous Chef v2

**Version:** 2.0
**Last updated:** 2026-03-18
**Status:** In development
**Supersedes:** PRD v1.0

---

## 1. Overview

Recipe Keeper is a personal recipe management and cooking companion tool. It captures recipes the way people actually cook — with all the tips, tricks and secrets that never make it into a standard written recipe — and then guides users through those same recipes in real-time via a voice-first AI sous chef.

Version 2 focuses on three areas: making the sous chef's voice feel natural and conversational, giving users full control over when a cooking session begins, and making the experience first-class on phones and tablets — the most likely kitchen devices.

---

## 2. Engineering Standards

These are permanent, non-negotiable project practices that apply to every feature and every iteration:

| Standard | Requirement |
|---|---|
| **Git commit at every step** | Every completed implementation step is committed to git with a descriptive message. This enables clean rollbacks if something goes wrong and keeps history readable. |
| **Tests before every commit** | `npm test` must pass (all tests green) before any commit is made. New features require new tests. Existing tests must not regress. |
| **Test documentation** | `docs/TESTING.md` is updated at each iteration with new coverage descriptions. |

These are not developer preferences — they are product quality standards.

---

## 3. Problem Statement

### v1 problems (carried forward)
1. **Recipe knowledge is lost over time.** Family recipes, personal techniques and hard-won cooking secrets live in people's heads. Existing tools only capture ingredients and steps.
2. **Cooking is hands-busy and attention-split.** A proactive voice assistant that knows the recipe is more useful than a static page.

### v2 problems (new)
3. **AI voice feels robotic.** Claude prefixes responses with "Great!", "Of course!", "Absolutely!" — phrases that sound unnatural and wasteful when read aloud by TTS. Responses need to be tighter and more direct.
4. **Session start is confusing.** The AI speaks immediately when the cook page loads, before the user is oriented. The mic activates right after, creating confusion between AI output and user input.
5. **The UI is desktop-first.** Phones and tablets are the most likely kitchen devices, but safe areas, touch targets and the recipe step view are all designed for large screens.

---

## 4. Target User

- Home cooks who cook regularly and have accumulated personal techniques
- Anyone wanting to preserve family or inherited recipes with full context
- Cooks who want voice-guided cooking on a phone or tablet in the kitchen
- Couples, families or friends cooking together (future — see Section 9)

---

## 5. Core Features

### 5.1 Recipe Capture ✅ Shipped
- **Voice narration:** Dictate a recipe while cooking; AI structures it automatically
- **Paste/type:** Paste from any source (old notes, websites, books)
- **URL import:** Paste a recipe URL and import it directly
- All modes extract: ingredients, steps, tips, tricks, secrets and notes
- sessionStorage safety net: auto-saves narration transcript every 30s; restore banner on return

### 5.2 Recipe Management ✅ Shipped
- Recipe Box dashboard with search and category sections
- Categories: Starters, Mains, Desserts, Sides, Soups & Salads, Breakfast, Snacks, Drinks, Sauces, Other
- Dietary tags: VE, V, GF, DF, NF (EU/UK standard symbols)
- Allergen detection: EU/UK Big 14
- Serving size calculator with live ingredient scaling
- Full inline edit mode per recipe
- Auto-classification of new recipes by Claude
- AI backfill for existing untagged recipes

### 5.3 AI Sous Chef ✅ Shipped (Phase 1)
- Dedicated cooking session at `/cook/[id]`
- Streaming conversational Claude API (`/api/sous-chef`)
- TTS output via Web Speech Synthesis (sentence-by-sentence streaming)
- Voice input with auto-send on 2s silence
- Step-by-step guidance with progress tracking
- Proactive tip/secret surfacing
- Text input fallback for non-Chrome browsers
- "Start Cooking" button on recipe card
- Full-screen dark cooking UI

### 5.4 AI Sous Chef v2 (In Development)

#### 5.4.1 Natural Voice Quality
The sous chef's responses should feel like talking to a knowledgeable friend, not reading a chatbot transcript aloud.

- **No filler preambles:** Responses never open with affirmations ("Great!", "Of course!", "Absolutely!", "Sure!", "Certainly!", "Happy to help!", "Sounds good!", "Perfect!")
- **Direct and warm:** First word addresses the question or action. Warmth comes from word choice, not pleasantries.
- **Short responses:** 1–2 sentences for confirmations; 2–3 for multi-part instructions. Never longer.
- **`max_tokens: 200`** (enforced at model level, down from 300)

#### 5.4.2 User-Initiated Session Start ("Hello Chef")
The cooking session should start only when the cook is ready — not the moment the page loads.

- On load: a "waiting" screen is shown. AI is silent. Mic is listening.
- Cook says "Hello Chef" (or any wake phrase: "Hey Chef", "Start", "Let's begin", "Ready") **or** taps the "Start Cooking" button.
- That phrase becomes the first user message. AI responds with a natural greeting and ingredient check.
- This eliminates the confusion between AI output and accidental user input at session start.
- **Future-proof design:** Wake-phrase detection is isolated to a single function, designed for drop-in replacement with a noise-robust library (e.g. Porcupine) when multi-user or noisy environment support is added.

#### 5.4.3 Mobile & Tablet Support
Phones and tablets are the primary cooking devices. The sous chef UI must be first-class on them.

- **iOS Safe Areas:** Bottom mic area and top bar respect `env(safe-area-inset-bottom/top)` so no content is hidden behind the home indicator or notch.
- **Viewport:** `viewport-fit=cover` set in Next.js layout to enable safe area CSS.
- **Touch targets:** All interactive elements ≥ 44×44px (iOS Human Interface Guidelines).
- **Mobile recipe steps drawer:** The recipe step sidebar (desktop-only in v1) becomes accessible on mobile via a "Steps" toggle button in the top bar. Tapping shows a full-screen overlay with all steps listed, current step highlighted in amber.

---

## 6. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Voice narration session length | 30–40 min via Web Speech API auto-restart |
| Sous chef response latency | First spoken word within ~2s of user finishing |
| Touch target minimum | 44×44px (iOS HIG) |
| Mobile browser support | iOS Safari 15+, Chrome Android |
| Safe area compliance | iPhone notch + home bar |
| Viewport | `viewport-fit=cover` |
| Offline support | Not required (Claude API needs network) |
| Desktop browser support | Chrome/Edge (primary); Safari/Firefox (text fallback) |
| Data storage | Browser localStorage (no server-side user data) |
| API costs | Claude API credits; user provides their own key |

---

## 7. Future-Proofing Note

Although multi-user, multi-device, and noisy-environment support are out of scope for v1–v2, every technical decision is made with that future in mind:

- **Wake-phrase detection** is isolated to a single `handleBegin()` function. A simple regex today, this can be replaced with Porcupine or a Whisper-based approach without touching the session UI or TTS layer.
- **Voice input interface** (`onSend`, `onSpeechStart`) is a clean abstraction over Web Speech API. Swapping in a noise-robust alternative (Whisper API, Deepgram, etc.) requires only replacing `CookingVoiceInput.tsx` internals — nothing in the session or API layer changes.
- **The sous chef API is stateless and recipe-scoped.** Adding a `userId` or `sessionId` field for multi-user sessions is a one-field addition to the request interface.
- **The conversation window slides.** The last 20 messages are sent on every turn. This is already the right architecture for shared sessions where multiple people contribute turns.

---

## 8. Out of Scope (v2)

- Multi-user / multi-person cooking sessions
- Noisy environment audio enhancement / noise-robust STT
- Native wake word ("Hey Chef") — simple regex wake phrase only in v2
- User accounts / cloud sync
- In-session timers
- Mid-session recipe editing
- Session persistence after page close
- Multi-language support
- Nutritional information
- Social sharing / PDF export
- Native mobile app

---

## 9. Forward Roadmap (Phase 6 — Multi-User & Accessibility)

> Planned, not in scope for v2. Documented here to inform architecture decisions.

- **Multi-person cooking:** Couples, families, friends sharing one cooking session. The sous chef addresses the group ("you two", "whoever is by the hob") and handles multiple voices.
- **Noise-robust STT:** Kitchen environments are loud (extraction fans, sizzling, running water). Replace Web Speech API with a noise-robust alternative (Whisper API, Deepgram, Porcupine for wake word).
- **Haptic feedback:** `navigator.vibrate()` as a complement to voice cues in loud kitchens.
- **Accessibility:** Screen reader support, high-contrast mode, larger text option.
- **Multi-language:** Sous chef in French, Spanish, Italian etc. for international recipes.

---

## 10. Success Criteria

- User can narrate a 30-minute recipe session without data loss
- Generated recipes correctly capture tips and secrets, not just steps
- Sous chef responses never begin with filler words; feel like a knowledgeable friend
- No confusion at session start — AI is silent until cook is ready
- Allergen and dietary tags are accurate on auto-detection
- Recipe cards are readable and usable during cooking on a phone
- Mobile safe areas: no UI hidden behind iPhone notch or home indicator
- All features have automated tests; `npm test` passes on every commit

---

## 11. Engineering Checklist (per ticket)

Before marking any ticket complete:
- [ ] Feature works end-to-end in the browser
- [ ] New tests written for new code paths
- [ ] `npm test` passes (all green)
- [ ] Changes committed to git with descriptive message
- [ ] `docs/TESTING.md` updated if new test files added
