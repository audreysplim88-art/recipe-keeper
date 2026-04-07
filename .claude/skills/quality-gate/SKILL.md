---
name: quality-gate
description: >
  Run a comprehensive quality gate before deploying or after significant code changes.
  Covers tests, type checking, security, performance, and tech debt.
  TRIGGER when: the user says "deploy", "quality check", "run tests", "check before deploy",
  "quality gate", "/quality-gate", "are we good to deploy", "pre-deploy check",
  or after completing a batch of code changes. Also trigger proactively when you've
  just finished implementing a feature or fixing a bug — run this before telling the
  user "all done". When in doubt, run it — catching issues early is always worth the
  30 seconds it takes.
---

# Quality Gate

A pre-deploy and post-change quality check that catches bugs, security gaps, performance
issues, and tech debt before they reach production. This gate **blocks deployment** if
tests fail or critical security issues are found.

## When to Run

- Before every `vercel --prod` or `git push` deployment
- After completing a feature, bugfix, or refactor
- When the user asks to check quality or deploy
- Proactively after significant code changes (3+ files modified)

## Steps

Run these checks in order. Stop and report if any blocking issue is found.

### 1. Test Suite

Run the full Jest test suite. This is a hard gate — all tests must pass.

```bash
cd <project-root>
npx jest --no-coverage --forceExit 2>&1
```

Report: total suites, total tests, pass/fail counts.
If any test fails, **STOP** — do not proceed to deployment. Fix the failures first.

### 2. TypeScript Type Check

Run the compiler in check mode. This is a hard gate — zero errors required.

```bash
npx tsc --noEmit 2>&1
```

Report: pass (no output) or list of type errors.
If any type errors exist, **STOP** — fix them before deploying.

### 3. Security Scan

**Quick scan** (every run): Check files changed since the last commit.
**Full scan** (periodic / on demand): Check all API routes and sensitive files.

For changed files, run: `git diff --name-only HEAD~1` to get the list.

Check for these issues, ordered by severity:

**Critical (blocks deploy):**
- API routes missing `requireAuth()` — every POST handler in `app/api/` must call it
  (except `app/api/stripe/webhook/route.ts` which uses Stripe signature verification)
- Hardcoded secrets — API keys, tokens, passwords in source (not in `.env*` files)
- `.env` files staged for commit — check `git diff --cached --name-only` for `.env*`

**Warning (report but don't block):**
- API routes missing `checkRateLimit()` — expensive endpoints should have rate limits
- Missing input validation — POST handlers should validate body content
- SSRF risk — any `fetch()` of user-supplied URLs should block private IP ranges
- Missing auth on new pages that access user data

For the full scan, read all files matching `app/api/**/route.ts` and verify each has
the auth + rate limit pattern.

### 4. Performance Check

Scan changed files and flag:

- **N+1 queries**: Supabase calls inside loops or `.map()` callbacks
- **Missing pagination**: `.select()` queries without `.limit()` on list endpoints
- **Unbounded arrays**: State arrays that grow without bounds (e.g., conversation history
  without pruning)
- **Missing caching headers**: API responses for cacheable content using `no-cache`
- **Large payloads**: Base64 encoding without size limits, `select("*")` when fewer
  columns would suffice

These are warnings, not blockers — report them for the user to prioritise.

### 5. Tech Debt Sweep

Scan the codebase (excluding `node_modules`, `.next`, `ios/App/CapApp-SPM`):

```bash
# TODOs and FIXMEs
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next

# console.logs in production code (not in test files)
grep -rn "console\.\(log\|debug\)" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=__tests__
```

Report counts and file locations. These are informational — not blockers unless
excessive (>20 console.logs in production code is a yellow flag).

## Report Format

Summarise all findings in this format:

```
## Quality Gate Report

### Tests: ✅ PASS (193/193)
10 suites, 193 tests, 0 failures

### Types: ✅ PASS
No type errors

### Security: ✅ PASS | ❌ BLOCKED | ⚠️ WARNINGS
- [Critical] Missing auth on /api/new-endpoint — BLOCKS DEPLOY
- [Warning] /api/foo missing rate limit

### Performance: ✅ CLEAN | ⚠️ ISSUES
- [Warning] Unbounded array in SomeComponent.tsx:45

### Tech Debt: 📋 3 TODOs, 5 console.logs
- lib/foo.ts:12 — TODO: add error handling
- components/Bar.tsx:88 — console.log("debug")
```

## Blocking Rules

The gate **blocks deployment** if ANY of these are true:
- Test suite has failures
- TypeScript has type errors
- Critical security issues found (missing auth, hardcoded secrets, .env staged)

The gate **warns but allows deployment** for:
- Missing rate limits
- Performance issues
- Tech debt items
- Non-critical security warnings

## After the Gate

If the gate passes, tell the user: "Quality gate passed — safe to deploy."
If blocked, list the specific failures and offer to fix them.
If warnings only, list them and ask: "These warnings are non-blocking. Deploy anyway?"
