# Testing Guide
## Recipe Keeper

**Last updated:** 2026-03-18

---

## Stack

| Tool | Purpose |
|---|---|
| [Jest 30](https://jestjs.io/) | Test runner and assertion library |
| [React Testing Library](https://testing-library.com/react) | Component testing (user-behaviour focused) |
| [@testing-library/user-event](https://testing-library.com/docs/user-event/intro/) | Simulating real user interactions |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | Custom DOM matchers (`toBeInTheDocument`, etc.) |
| jsdom | Browser-like environment for Node |

---

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes — useful during development)
npm run test:watch

# With coverage report
npm run test:coverage
```

---

## Test Structure

```
__tests__/
├── lib/
│   ├── tts.test.ts          # TTSManager unit tests
│   └── storage.test.ts      # localStorage CRUD tests
├── api/
│   └── sous-chef.test.ts    # Sous chef API route tests  (added Step 3)
└── components/
    ├── CookingVoiceInput.test.tsx   (added Step 4)
    └── SousChefSession.test.tsx     (added Step 5)
```

---

## Coverage by Module

### `lib/tts.ts` — 16 tests ✅
Tests the `TTSManager` class that drives voice output in the sous chef feature.

| Test group | What is covered |
|---|---|
| `isAvailable` | Returns true when `speechSynthesis` exists on window |
| `appendText` | Sentence splitting on `.` `!` `?`; buffer accumulation across chunks; empty input ignored |
| `flush` | Speaks remaining buffer; idempotent on empty buffer; clears buffer after flushing |
| `interrupt` | Calls `cancel()`; empties queue; fires `onSpeakingChange(false)`; sets `isSpeaking` false |
| `onSpeakingChange` | Fires `true` on first utterance; `false` after last; stays `true` between chained sentences |
| `destroy` | Cancels speech and tears down timers without throwing |

**Key mocks:** `window.speechSynthesis` (speak, cancel, pause, resume, getVoices), `SpeechSynthesisUtterance` — all stubbed so tests run in Node/jsdom without a real browser.

---

### `lib/storage.ts` — 16 tests ✅
Tests the localStorage CRUD layer.

| Test group | What is covered |
|---|---|
| `getRecipes` | Empty array on cold start; returns stored recipes; graceful on corrupt JSON |
| `getRecipe` | Finds by id; returns null for missing id |
| `saveRecipe` | Adds new recipes; prepends so newest is first; updates without duplicating; persists all fields |
| `deleteRecipe` | Removes by id; leaves other recipes untouched; no-op on unknown id |
| `generateId` | Returns non-empty string; unique across 50 calls; has `recipe-` prefix |

---

### `app/api/sous-chef` — (added Step 3)
*See Step 3 commit.*

---

### `components/CookingVoiceInput` — (added Step 4)
*See Step 4 commit.*

---

### `components/SousChefSession` — (added Step 5)
*See Step 5 commit.*

---

## Testing Philosophy

### What we test
- **Business logic in utilities** (`lib/`) — pure functions and classes with clear inputs/outputs
- **API route contracts** — correct status codes, response shapes, error handling
- **Component behaviour** — what the user sees and can interact with, not implementation details

### What we don't test
- Next.js routing internals
- Tailwind CSS class names
- Third-party library internals (Anthropic SDK, Web Speech API internals)

### Mocking strategy
- **Browser APIs** (`speechSynthesis`, `SpeechRecognition`, `localStorage`) — mocked at the module level in each test file
- **Anthropic SDK** — mocked with `jest.mock('@anthropic-ai/sdk')` in API route tests
- **`fetch`** — mocked with `jest.spyOn(global, 'fetch')` in component tests that call API routes

### Guiding principle
Tests should break when behaviour changes, not when implementation changes. Prefer testing what the user experiences over testing internal state.

---

## Adding Tests for New Features

When adding a new feature or fixing a bug:

1. Create a test file in the appropriate `__tests__/` subdirectory
2. Add a row to the **Coverage by Module** table above
3. Run `npm test` to confirm all tests pass before committing
4. If a bug is fixed, add a regression test that would have caught it

---

## CI / Automation

Tests run locally for now. To add them to a CI pipeline (e.g. GitHub Actions), create `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test
```
