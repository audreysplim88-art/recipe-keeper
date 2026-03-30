# Product Roadmap
## Recipe Keeper — AI Sous Chef

**Last updated:** 2026-03-30

---

## Engineering Standards (always-on)

> These apply to every phase and every ticket — not a phase themselves.

| Standard | Rule |
|---|---|
| **Git commit every step** | Each completed step is committed to git with a descriptive message. Enables clean rollbacks. |
| **Tests before every commit** | `npm test` must pass before any commit. New features require new tests. No regressions allowed. |
| **Data loss prevention** | Every page with unsaved user input must use `useUnsavedChangesWarning(isDirty)`. Covers both browser-level (refresh/close) and in-app navigation. Required for: narration, paste input, recipe editing, and any future form. |

---

## Phase 1 — AI Sous Chef ✅ Shipped
*Goal: Turn the recipe box into a real-time cooking companion*

| Feature | Status |
|---|---|
| Dedicated cooking session page (`/cook/[id]`) | ✅ Shipped |
| Streaming conversational Claude API (`/api/sous-chef`) | ✅ Shipped |
| TTS output via Web Speech Synthesis | ✅ Shipped |
| Conversational voice input (auto-send on silence) | ✅ Shipped |
| Step-by-step guidance with progress tracking | ✅ Shipped |
| Proactive tip/secret surfacing at the right moment | ✅ Shipped |
| Text input fallback (non-Chrome browsers) | ✅ Shipped |
| "Start Cooking" button on recipe card | ✅ Shipped |
| sessionStorage backup for long capture sessions | ✅ Shipped |
| Jest test suite (75 tests across lib, API, components) | ✅ Shipped |

---

## Phase 2 — Voice Quality & Mobile (Current)
*Goal: Make the sous chef feel natural and work first-class on kitchen devices*

| Feature | Status |
|---|---|
| Natural TTS voice — no filler words, direct and warm responses | 🔄 In Progress |
| User-initiated session start ("Hello Chef" wake phrase + button) | 🔄 In Progress |
| iOS safe area insets (notch + home indicator support) | 🔄 In Progress |
| Mobile recipe steps drawer (toggle overlay on small screens) | 🔄 In Progress |
| Touch target sizing ≥44px (iOS Human Interface Guidelines) | 🔄 In Progress |
| `viewport-fit=cover` for full-screen cooking UI on iPhone | 🔄 In Progress |

---

## Phase 2.5 — UI Polish: Gastronom First Iteration
*Goal: Rebrand, tighten copy, remove emoji clutter, add category filtering*

| Feature | Status |
|---|---|
| Dashboard rebrand (Gastronom) + category filter (UI-001) | 🔲 Backlog |
| Compact recipe grid cards (UI-002) | 🔲 Backlog |
| Capture interface copy refresh & emoji removal (UI-003) | 🔲 Backlog |
| Recipe detail header — description, button, edit/delete (UI-004) | 🔲 Backlog |
| Sous Chef waiting screen redesign (UI-005) | 🔲 Backlog |
| Sous Chef concise opening message (UI-006) | 🔲 Backlog |

---

## Phase 3 — Performance & Cooking Session Enhancements
*Goal: Make the sous chef fast enough for a real kitchen, then smarter*

> Performance items are highest priority in this phase — latency issues identified from real use must be resolved before new session features are added.

| Feature | Status |
|---|---|
| **Wake phrase detection latency <500ms** (interim result matching) | 🔲 Backlog |
| **AI response latency** (Edge Runtime + TTS sentence threshold) | 🔲 Backlog |
| Built-in cooking timers ("set a 10-minute timer") | 🔲 Backlog |
| Ingredient substitution suggestions | 🔲 Backlog |
| Serving size aware guidance ("you scaled to 8, so use double…") | 🔲 Backlog |
| Session summary on completion (what you made, tips reviewed) | 🔲 Backlog |
| Mid-session note capture ("add this to the recipe secrets") | 🔲 Backlog |
| Resume interrupted session | 🔲 Backlog |

---

## Phase 4 — Recipe Intelligence
*Goal: Make the recipe box smarter over time*

| Feature | Status |
|---|---|
| Recipe version history (track edits over time) | 🔲 Backlog |
| "Cook this again" mode with notes from previous sessions | 🔲 Backlog |
| AI-suggested improvements after a cooking session | 🔲 Backlog |
| Cross-recipe search ("what can I make with chicken and lemon?") | 🔲 Backlog |
| Meal planning (suggest weekly recipes from your box) | 🔲 Backlog |
| Recipe difficulty rating (auto-inferred from steps) | 🔲 Backlog |

---

## Phase 5 — Sharing & Portability
*Goal: Get recipes out of the browser*

| Feature | Status |
|---|---|
| Export recipe as PDF (printable card format) | 🔲 Backlog |
| Export recipe box as JSON backup | 🔲 Backlog |
| Import from exported JSON | 🔲 Backlog |
| Share individual recipe via link (read-only) | 🔲 Backlog |
| Cloud sync / account (move beyond localStorage) | 🔲 Backlog |

---

## Phase 6 — Multi-User, Noise Resilience & Accessibility
*Goal: Support real kitchen environments — families, couples, noisy spaces*

> Architecture decisions in Phases 1–2 are intentionally forward-compatible with this phase. Wake-phrase detection is isolated to a single replaceable function. The voice input interface (`onSend`, `onSpeechStart`) is a clean abstraction over Web Speech API. The API is stateless and recipe-scoped. See PRD-v2.md §7.

| Feature | Status |
|---|---|
| Multi-person cooking sessions (couples, families, friends) | 🔲 Backlog |
| Noise-robust STT (Whisper API / Deepgram evaluation spike) | 🔲 Backlog |
| Native wake word ("Hey Chef") via Porcupine or equivalent | 🔲 Backlog |
| Haptic feedback as complement to voice in loud kitchens | 🔲 Backlog |
| Accessibility: screen reader support, high-contrast mode | 🔲 Backlog |
| Larger text / display mode for cooking UI | 🔲 Backlog |
| Multi-language TTS and STT | 🔲 Backlog |
| Progressive Web App (installable, home screen icon) | 🔲 Backlog |

---

## Phase 7 — Accounts & Sync
*Goal: Recipes survive across browsers and devices*

| Feature | Status |
|---|---|
| User accounts (sign-up / login) | 🔲 Backlog |
| Cloud recipe storage (e.g. Supabase) | 🔲 Backlog |
| Cross-device sync | 🔲 Backlog |
| Shared recipe collections (family recipe box) | 🔲 Backlog |

---

## Status Key
| Symbol | Meaning |
|---|---|
| ✅ | Shipped |
| 🔄 | In progress |
| 🔲 | Planned / Backlog |
| ⏸ | On hold |
| ❌ | Cancelled |
