# Dodol — Multi-User Platform Backlog

**Source PRD:** `docs/PRD-multi-user-platform.md`
**Last updated:** 2026-03-31

Each issue is a thin vertical slice through all layers (schema → API → UI → tests).
HITL = requires human steps outside the codebase. AFK = fully automatable.

---

## Issue 1 — Auth: Sign-up, Sign-in, Email Confirmation, Route Protection
**Type:** AFK
**Blocked by:** None — can start immediately

### What to build
End-to-end authentication using Supabase Auth. A new user can create an account with their first name, email, and password. They receive a confirmation email and cannot access the app until confirmed. Existing users can sign in. All authenticated routes redirect unauthenticated visitors to `/auth/sign-in`. On successful sign-up, a `profiles` row (first_name) and a default `subscriptions` row (plan=free) are created.

This is the foundation that every other issue depends on.

### Acceptance criteria
- [ ] New user can sign up with first name, email, and password
- [ ] Confirmation email is sent; unconfirmed users see a "check your email" holding screen
- [ ] User can sign in with email and password
- [ ] Session persists across browser refresh and Capacitor app restarts
- [ ] All routes except `/auth/*` redirect unauthenticated users to `/auth/sign-in`
- [ ] On sign-up, `profiles` row is created with `first_name`
- [ ] On sign-up, `subscriptions` row is created with `plan='free'`, `status='active'`
- [ ] Sign-in form shows a clear error for wrong credentials
- [ ] `AuthContext` exposes `{ user, profile, subscription, loading }` to all client components

### Files
- `lib/supabase/client.ts` — browser Supabase client
- `lib/supabase/server.ts` — server Supabase client (for API routes)
- `lib/supabase/middleware.ts` — session refresh helper
- `middleware.ts` — route protection
- `lib/auth-context.tsx` — React context + AuthProvider
- `app/auth/sign-in/page.tsx`
- `app/auth/sign-up/page.tsx`
- `app/auth/callback/route.ts` — Supabase auth redirect handler
- `app/layout.tsx` — wrap with AuthProvider

### User stories addressed
- PRD §4.1 Authentication

---

## Issue 2 — Password Reset Flow
**Type:** AFK
**Blocked by:** Issue 1

### What to build
Allow users who have forgotten their password to request a reset email. The link in the email redirects back into the app where they can set a new password.

### Acceptance criteria
- [ ] "Forgot password?" link on sign-in page navigates to `/auth/forgot-password`
- [ ] User submits their email and receives a reset link (via Supabase `resetPasswordForEmail`)
- [ ] Clicking the email link opens the app at `/auth/callback` and then a "set new password" form
- [ ] On success, user is redirected to sign-in with a confirmation message
- [ ] Submitting an unknown email shows no error (prevents user enumeration)

### Files
- `app/auth/forgot-password/page.tsx`
- `app/auth/reset-password/page.tsx` — new password form
- `app/auth/callback/route.ts` — updated in Issue 1, handles password reset token type

### User stories addressed
- PRD §4.1 Authentication

---

## Issue 3 — Cloud Recipe Storage + localStorage Migration
**Type:** AFK
**Blocked by:** Issue 1

### What to build
Move all recipe persistence from browser localStorage to Supabase PostgreSQL. Recipes are scoped to the authenticated user and available on any device. On the user's first login after account creation, if they have recipes in localStorage on that device, a one-time prompt offers to import them to their account.

This unblocks the paywall (Issue 4), which needs a server-side recipe count.

### Acceptance criteria
- [ ] All `lib/storage.ts` functions are async and query Supabase instead of localStorage
- [ ] Row Level Security ensures users can only read/write their own recipes
- [ ] Creating a recipe on one device is immediately visible when signing in on another
- [ ] Deleting a recipe removes it from all devices
- [ ] On first sign-in, if localStorage contains recipes, a banner appears: "You have [N] recipes saved on this device. Import them to your account?"
- [ ] Confirming migrates all localStorage recipes to Supabase and clears localStorage
- [ ] Dismissing clears the banner permanently
- [ ] The allergen backfill feature (auto-classify dietary tags) continues to work as before
- [ ] `npx tsc --noEmit` passes; existing test suite updated to mock Supabase instead of localStorage

### Database
```sql
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  dietary_tags TEXT[] DEFAULT '{}',
  allergens TEXT[] DEFAULT '{}',
  servings TEXT NOT NULL DEFAULT '',
  prep_time TEXT NOT NULL DEFAULT '',
  cook_time TEXT NOT NULL DEFAULT '',
  ingredients JSONB NOT NULL DEFAULT '[]',
  instructions TEXT[] NOT NULL DEFAULT '{}',
  tips JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recipes" ON recipes FOR ALL USING (auth.uid() = user_id);
```

### Files
- `lib/storage.ts` — all functions become async, Supabase queries
- `lib/migration.ts` — `migrateLocalRecipes(userId)`: reads localStorage, upserts to Supabase, clears localStorage
- `app/page.tsx` — async recipe loading, migration banner
- `app/capture/page.tsx` — async `saveRecipe`
- `app/recipe/[id]/RecipePage.tsx` — async `getRecipe`
- `app/cook/[id]/CookPage.tsx` — async `getRecipe`
- `components/RecipeCard.tsx` — async save/delete

### User stories addressed
- PRD §4.2 Cloud Recipe Storage (Cross-Device Sync)

---

## Issue 4 — Freemium Paywall + Stripe Checkout
**Type:** AFK
**Blocked by:** Issue 3

### What to build
Enforce the 3-recipe free limit. When a free user attempts to save their 4th recipe, show a paywall modal before the save is committed. The modal presents monthly (£5.99) and annual (£55) plans. On the web, tapping a plan creates a Stripe Checkout session and redirects to the hosted Stripe payment page. On success/cancel, Stripe redirects back to the app. Also provides a Stripe Customer Portal session endpoint for subscription management (used in Issue 7).

Note: iOS native payment (Apple IAP via RevenueCat) is covered in Issue 6. The `isNativeApp()` check in the paywall modal gates which flow to trigger.

### Acceptance criteria
- [ ] Free users can save up to 3 recipes without any paywall
- [ ] Attempting to save a 4th recipe (while on free plan) shows `PaywallModal` before the save
- [ ] PaywallModal clearly shows both plans, prices, and the annual saving (~23%)
- [ ] Tapping a web plan calls `POST /api/stripe/create-checkout-session` and redirects to Stripe
- [ ] On successful payment, user is returned to the app at `/capture` or the recipe they were saving
- [ ] On cancel, user is returned to the paywall modal
- [ ] `POST /api/stripe/create-portal-session` returns a Stripe Customer Portal URL (used by Issue 7)
- [ ] Stripe Checkout is skipped and `PaywallModal` shows a native IAP stub when `isNativeApp()` is true (wired up properly in Issue 6)
- [ ] Free users who hit the limit retain full read access to their existing recipes

### Files
- `lib/subscription.ts` — `getRecipeCount(userId)`, `hasActiveSubscription(sub)`, `canCreateRecipe(userId)`
- `lib/platform.ts` — `isNativeApp()`: detects `window.Capacitor?.isNativePlatform()`
- `lib/constants.ts` — add `FREE_RECIPE_LIMIT = 3`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`
- `components/PaywallModal.tsx`
- `app/api/stripe/create-checkout-session/route.ts`
- `app/api/stripe/create-portal-session/route.ts`
- `app/capture/page.tsx` — add paywall check before `saveRecipe`

### User stories addressed
- PRD §4.3 Subscription & Paywall

---

## Issue 5 — Stripe Webhook: Subscription Lifecycle → Supabase
**Type:** AFK
**Blocked by:** Issue 4

### What to build
Handle Stripe webhook events to keep the `subscriptions` table in Supabase up to date. When a user pays, upgrades, or cancels, the subscription row is updated and that change propagates across all devices immediately.

Kept separate from Issue 4 so Stripe Checkout can be tested end-to-end before webhook handling is wired up.

### Acceptance criteria
- [ ] `POST /api/stripe/webhook` verifies the Stripe signature before processing any event
- [ ] `customer.subscription.created` → sets `plan`, `status`, `stripe_subscription_id`, `current_period_end`
- [ ] `customer.subscription.updated` → updates `plan`, `status`, `current_period_end`
- [ ] `customer.subscription.deleted` → sets `plan='free'`, `status='canceled'`
- [ ] `invoice.payment_failed` → sets `status='past_due'`
- [ ] A newly paid user can immediately create their 4th recipe without reloading the app
- [ ] A cancelled subscriber loses create access at `current_period_end`, not immediately
- [ ] Webhook endpoint returns HTTP 200 for all handled event types; 400 for invalid signatures

### Files
- `app/api/stripe/webhook/route.ts`

### User stories addressed
- PRD §4.3 Subscription & Paywall

---

## Issue 6 — RevenueCat Native IAP for iOS (Apple In-App Purchase)
**Type:** HITL
**Blocked by:** Issue 4

### What to build
Enable iOS users to subscribe using Apple In-App Purchase. The RevenueCat Capacitor SDK handles the native purchase flow; a RevenueCat webhook updates the Supabase `subscriptions` table identically to the Stripe webhook.

**This issue requires manual steps in App Store Connect that cannot be automated.**

### Human steps required (HITL)
1. Enrol in Apple Developer Program ($99/year) at developer.apple.com
2. In App Store Connect, create two In-App Purchase products:
   - `app.dodol.recipes.monthly` — Auto-Renewable Subscription, £5.99/month
   - `app.dodol.recipes.annual` — Auto-Renewable Subscription, £55/year
3. Create a RevenueCat account at revenuecat.com
4. In RevenueCat: create project, connect App Store app, create "Pro" entitlement, map to both Apple products
5. Note: `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY`
6. Set up RevenueCat → webhook → `/api/revenuecat/webhook` in RevenueCat dashboard

### Acceptance criteria
- [ ] On iOS (Capacitor), tapping a plan in `PaywallModal` triggers the native Apple IAP sheet (not Stripe redirect)
- [ ] Successful purchase updates `subscriptions` table via RevenueCat webhook
- [ ] `app/api/revenuecat/webhook/route.ts` handles `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION` events
- [ ] iOS subscriber can immediately create recipes after purchase
- [ ] Subscription status is consistent between what RevenueCat reports and what Supabase shows
- [ ] `isNativeApp()` correctly returns `true` inside Capacitor and `false` on web

### Files
- `app/api/revenuecat/webhook/route.ts`
- `components/PaywallModal.tsx` — wire up RevenueCat `Purchases.purchaseProduct()` behind `isNativeApp()` guard
- `lib/platform.ts` — already created in Issue 4

### User stories addressed
- PRD §4.3 Subscription & Paywall (native mobile)

---

## Issue 7 — User Profile Header + Account & Subscription Settings Page
**Type:** AFK
**Blocked by:** Issues 1, 5

### What to build
A persistent header on all authenticated pages showing the user's avatar and "Hey [first_name]". Tapping opens a dropdown menu. An account page lets users edit their first name, change their password, view their current subscription, and manage or cancel it.

### Acceptance criteria
- [ ] All authenticated pages show a header with: circular avatar (grey person silhouette) + "Hey [first_name]" + chevron
- [ ] Tapping the avatar opens a dropdown with: Account, Subscription, FAQ & Help, Send Feedback, Log out
- [ ] "Log out" clears the Supabase session and redirects to `/auth/sign-in`
- [ ] Account page (`/account`) shows: first name (editable inline), email address (read-only), change password section, current plan + status, "Manage Subscription" button
- [ ] "Manage Subscription" opens the Stripe Customer Portal (web) or links to iOS subscription settings (native)
- [ ] Changing first name updates `profiles.first_name` and the header greeting immediately
- [ ] Change password triggers Supabase `updateUser({ password })` with current-password confirmation
- [ ] Header fits within iPhone safe area insets; dropdown is touch-friendly (44px min tap targets)

### Files
- `components/UserHeader.tsx`
- `app/account/page.tsx`
- `app/layout.tsx` — add `<UserHeader />` above `{children}`

### User stories addressed
- PRD §4.4 User Profile & Account Menu

---

## Issue 8 — First-Use Onboarding Tutorial
**Type:** AFK
**Blocked by:** Issue 7

### What to build
A guided walkthrough on first login using react-joyride speech-bubble tooltips. The tutorial highlights each major feature in order. Users can skip at any step. Completion is persisted so the tutorial never auto-starts again. The tutorial can be manually re-triggered from the FAQ page.

### Acceptance criteria
- [ ] Tutorial auto-starts when `profile.tutorial_completed === false` (first login after email confirmation)
- [ ] 7 steps cover: recipe library, add recipe button, capture modes, recipe card, Sous Chef mode, edit/delete, account menu
- [ ] Each step has a title, description, and is anchored to the correct UI element via `data-tour="..."` attribute
- [ ] User can skip the tutorial at any step; skipping marks `tutorial_completed = true`
- [ ] Completing the final step marks `tutorial_completed = true`
- [ ] Tutorial never auto-starts again after completion or skip
- [ ] Tutorial can be re-triggered by a "Replay tutorial" link on the FAQ page
- [ ] Tooltip styling matches the amber/stone colour palette

### `data-tour` attributes to add
- `data-tour="recipe-library"` — recipe grid on home page
- `data-tour="add-recipe-btn"` — "Add Recipe" button on home page
- `data-tour="capture-tabs"` — tab bar on capture page
- `data-tour="recipe-card"` — recipe card body
- `data-tour="sous-chef-btn"` — Sous Chef Mode button on recipe card
- `data-tour="edit-btn"` — Edit button on recipe card
- `data-tour="account-menu"` — avatar/greeting in header

### Files
- `components/Tutorial.tsx` — JoyrideTour wrapper
- `app/page.tsx` — mount `<Tutorial />`, add `data-tour` attrs
- `app/capture/page.tsx` — add `data-tour` attr
- `components/RecipeCard.tsx` — add `data-tour` attrs
- `components/UserHeader.tsx` — add `data-tour` attr

### User stories addressed
- PRD §4.5 Onboarding Tutorial

---

## Issue 9 — FAQ & Help Page + Header Shortcut
**Type:** AFK
**Blocked by:** Issue 7

### What to build
A static `/faq` page containing the same content as the onboarding tutorial steps, plus common questions about subscriptions, data privacy, and supported devices. Accessible via "FAQ & Help" in the account dropdown and a persistent "?" icon in the header.

### Acceptance criteria
- [ ] `/faq` page exists and is accessible to all authenticated users
- [ ] Page includes all 7 tutorial step descriptions as named sections
- [ ] Page includes an "About your subscription" section (how to upgrade, cancel, manage)
- [ ] Page includes a "Your data" section (recipes stored securely)
- [ ] Page includes a "Supported devices" section (web, iPhone via Dodol app)
- [ ] Header dropdown "FAQ & Help" link navigates to `/faq`
- [ ] A "?" icon in the header is always visible as a shortcut to `/faq`
- [ ] FAQ page includes a "Replay tutorial" button that re-triggers `Tutorial.tsx` from step 1

### Files
- `app/faq/page.tsx`
- `components/UserHeader.tsx` — add "?" icon + "FAQ & Help" dropdown item

### User stories addressed
- PRD §4.5 Onboarding Tutorial

---

## Issue 10 — In-App Feedback Form
**Type:** AFK
**Blocked by:** Issue 1

### What to build
A modal feedback form reachable from the account dropdown. Users select a type (Bug report, Feature request, General feedback) and write a message. Submissions are stored in Supabase and associated with the user's account.

### Acceptance criteria
- [ ] Feedback modal is accessible from: account dropdown ("Send Feedback") and account page
- [ ] Form has a type selector (Bug report / Feature request / General feedback) and a message textarea
- [ ] Minimum message length: 20 characters; maximum: 1,000 characters — validated client-side with live character count
- [ ] Submit button is disabled until validation passes
- [ ] On successful submission, modal shows a "Thank you!" confirmation and closes after 2 seconds
- [ ] On failure, modal shows an inline error without closing
- [ ] Submissions stored in `feedback` table with `user_id`, `type`, `message`, `created_at`

### Database
```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'general')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 20 AND 1000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "own feedback" ON feedback FOR SELECT USING (auth.uid() = user_id);
```

### Files
- `components/FeedbackModal.tsx`
- `app/api/feedback/route.ts`
- `components/UserHeader.tsx` — "Send Feedback" dropdown item (added alongside Issue 7)

### User stories addressed
- PRD §4.6 Feedback Form

---

## Dependency Graph

```
Issue 1 (Auth) ◄─────────────────────────────────────┐
├── Issue 2 (Password Reset)                          │
├── Issue 3 (Cloud Storage + Migration)               │
│   └── Issue 4 (Paywall + Stripe Checkout)           │
│       ├── Issue 5 (Stripe Webhook)  ────────────────┤
│       └── Issue 6 (RevenueCat iOS) [HITL]           │
└── Issue 10 (Feedback Form)                          │
                                                      ↓
                             Issue 7 (User Header + Account Page)
                             ├── Issue 8 (Tutorial)
                             └── Issue 9 (FAQ Page)
```

## Recommended Start Order

1. **Issue 1** — unblocks everything
2. **Issues 2, 3, 10** — can run in parallel once Issue 1 is done
3. **Issue 4** → **Issue 5** — sequential (Checkout before webhook)
4. **Issue 6** — can run in parallel with Issue 5 once HITL steps are complete
5. **Issue 7** — once Issues 1 and 5 are done
6. **Issues 8 and 9** — in parallel once Issue 7 is done
