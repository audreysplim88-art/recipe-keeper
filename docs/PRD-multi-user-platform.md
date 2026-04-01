# PRD: Dodol — Multi-User Platform

**Author:** Audrey Lim
**Status:** Draft
**Last updated:** 2026-03-31

---

## 1. Overview

Dodol is an AI-powered recipe management app that allows users to capture, organise, and cook with recipes using voice, text, photos, and URLs. It includes an interactive "Sous Chef" cooking mode with voice I/O and text-to-speech guidance.

The app is currently a single-user, client-side product (localStorage, no auth). This PRD covers the evolution to a multi-user, cloud-first platform with authentication, subscription billing, onboarding, and social features — ready for App Store and Google Play distribution.

---

## 2. Goals

- Enable users to create accounts and access their recipe library from any device
- Monetise via a freemium model: 3 free recipes, then a paid subscription
- Comply with App Store and Google Play payment requirements (Apple IAP / Google Play Billing)
- Provide a welcoming onboarding experience for new users
- Create a feedback channel for bug reports and feature requests

---

## 3. User Personas

**Home Cook (Primary):** Uses the app at home to save recipes from cookbooks, blogs, and their own experiments. Wants quick access while cooking with messy hands. Values simplicity.

**Food Enthusiast:** Actively builds a large recipe library. Uses the Sous Chef mode regularly. Values organisation by category, dietary tags, and the ability to scale servings.

---

## 4. Features

---

### 4.1 Authentication

**Description:**
Standard email/password sign-up and sign-in flow with password reset capability. Users provide their first name at sign-up (used for personalised greeting).

**Acceptance criteria:**
- User can sign up with first name, email, and password
- Email confirmation sent on sign-up; unconfirmed users cannot access the app
- User can sign in with email and password
- User can request a password reset email
- Session persists across browser refreshes and app restarts (Capacitor)
- Authenticated session is scoped per device; logging out on one device does not affect others
- All routes except `/auth/*` redirect unauthenticated users to `/auth/sign-in`

**Technical notes:**
- Supabase Auth (email/password provider)
- `@supabase/ssr` for Next.js session management
- `middleware.ts` for route protection
- On sign-up: create `profiles` row (first_name) + default `subscriptions` row (plan=free)

---

### 4.2 Cloud Recipe Storage (Cross-Device Sync)

**Description:**
All recipes are stored in Supabase PostgreSQL, scoped to the authenticated user. Recipes created on one device are immediately available on all others.

**Acceptance criteria:**
- Creating, editing, and deleting recipes persists to the cloud in real time
- Recipes are private to the owning user (no recipe sharing in this version)
- Recipes load on app start from the server, not from localStorage
- On first login after account creation, if the user has recipes in localStorage on that device, they are offered a one-time migration prompt: "Import your existing recipes to your account?"
- The allergen backfill feature (auto-detect dietary tags) continues to work as before

**Technical notes:**
- `lib/storage.ts` functions become async, querying Supabase instead of localStorage
- Row Level Security (RLS) ensures users can only read/write their own recipes
- `lib/migration.ts` handles the one-time localStorage → Supabase migration

---

### 4.3 Subscription & Paywall

**Description:**
New users can create up to 3 recipe cards for free. To create a 4th and beyond, they must subscribe. Two plans are available: monthly and annual.

**Pricing:**
- Free: up to 3 recipes
- Monthly: £5.99/month
- Annual: £55/year (~23% saving vs monthly)

**Acceptance criteria:**
- Free users can create up to 3 recipes with no friction
- When a free user attempts to save their 4th recipe, a paywall modal appears before the save is committed
- Paywall modal clearly shows both plans with prices and the annual saving
- Paid users have no recipe limit
- If a subscription expires or is cancelled, the user retains read access to all their recipes but cannot create new ones until they resubscribe
- Subscription status is consistent across all devices (sourced from the server)

**Payment platforms:**
- **Web (Vercel):** Stripe Checkout (hosted page) — redirects to Stripe, returns to app on success
- **iOS (App Store):** Apple In-App Purchase via RevenueCat Capacitor SDK
- **Android (Google Play):** Google Play Billing via RevenueCat Capacitor SDK
- Stripe webhooks + RevenueCat webhooks both update the same `subscriptions` table in Supabase
- All platform checks use `subscriptions.plan` and `subscriptions.status` from Supabase

**Subscription management:**
- Web: Stripe Customer Portal (self-service cancel, upgrade, update payment method)
- Mobile: Managed by App Store / Google Play subscription settings

---

### 4.4 User Profile & Account Menu

**Description:**
A persistent header element on all pages showing the user's avatar and personalised greeting. Tapping opens an account menu with navigation to key settings.

**Acceptance criteria:**
- Header shows a circular avatar (grey with person silhouette) and "Hey [first_name]" on all authenticated pages
- Tapping the avatar/name opens a dropdown with: Account, Subscription, FAQ & Help, Send Feedback, Log out
- Account page shows: first name (editable), email address, change password, current subscription plan and status, "Manage Subscription" button
- Log out clears the session and redirects to `/auth/sign-in`
- Layout is mobile-first; header fits within safe area insets on iPhone

---

### 4.5 Onboarding Tutorial

**Description:**
On first login, a guided walkthrough highlights all major features using speech-bubble tooltips. The tutorial can be skipped at any time. The same content is permanently accessible via a FAQ & Help page and an "i" / "?" icon in the header.

**Tutorial steps:**
1. **Recipe Library** — "This is your recipe library. All your cards live here, searchable and organised by category."
2. **Add Recipe** — "Tap here to add a new recipe. You can narrate it, paste text, import from a URL, or snap a photo."
3. **Capture Modes** — "Choose how you want to capture: voice, text, URL, or camera."
4. **Recipe Card** — "Your recipe card. View ingredients, scale servings, check allergen info, and read helpful tips."
5. **Sous Chef Mode** — "Start a hands-free cooking session. Just say 'Hello Chef' and I'll guide you step by step."
6. **Edit & Delete** — "Tap Edit to update any recipe. You can change ingredients, instructions, tips — everything."
7. **Account Menu** — "Your account, subscription, and settings live here."

**Acceptance criteria:**
- Tutorial auto-starts on first login (after email confirmation)
- User can skip at any step; skipping marks tutorial as complete
- Completion is stored in `profiles.tutorial_completed` — tutorial never auto-starts again
- All tutorial content is also available at `/faq` as a static help page
- Header contains a persistent "?" link that opens the FAQ page

---

### 4.6 Feedback Form

**Description:**
A simple in-app form for users to submit bug reports, feature requests, and general feedback.

**Acceptance criteria:**
- Accessible from the account dropdown menu and the account page
- Form includes: type (Bug report / Feature request / General feedback) and message
- Submissions are stored in Supabase `feedback` table, associated with the user's account
- Form shows a success confirmation after submit
- Character minimum: 20 characters; character maximum: 1000 characters

---

## 5. Out of Scope (This Version)

- Recipe sharing / social features
- Third-party OAuth (Google, Apple sign-in)
- Push notifications
- Offline mode (app requires internet for Claude API anyway)
- Admin dashboard for viewing feedback submissions (direct Supabase access for now)
- Android app submission (iOS first, Android in a follow-up iteration)

---

## 6. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Mobile | Capacitor 8 (iOS + Android) |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL |
| Web payments | Stripe |
| Native payments | RevenueCat + Apple IAP + Google Play Billing |
| AI | Anthropic Claude (Sonnet for recipes, Haiku for classification) |
| Tutorial | react-joyride |
| Hosting | Vercel |

---

## 7. Database Schema

```sql
profiles (id, first_name, tutorial_completed, created_at)
subscriptions (id, user_id, plan, status, stripe_customer_id, stripe_subscription_id, revenuecat_customer_id, current_period_end, created_at, updated_at)
recipes (id, user_id, title, description, category, dietary_tags, allergens, servings, prep_time, cook_time, ingredients, instructions, tips, created_at, updated_at)
feedback (id, user_id, type, message, created_at)
```

---

## 8. Success Metrics

- Sign-up conversion rate (users who complete email confirmation)
- Free-to-paid conversion rate (users who hit the paywall and subscribe)
- Monthly active users (MAU)
- Average recipes per paid user
- Feedback form submission volume

---

## 9. Implementation Phasing

| Phase | Scope | Unblocks |
|-------|-------|---------|
| A | Supabase auth (sign-up, sign-in, password reset, route protection) | All subsequent phases |
| B | Cloud recipe storage + localStorage migration | Paywall, cross-device sync |
| C | Stripe web subscription + paywall modal | RevenueCat, account page |
| D | RevenueCat native IAP (iOS) | App Store submission |
| E | User profile UI (header, account page) | Tutorial |
| F | Tutorial + FAQ page | — |
| G | Feedback form | — |

Phases C and D can be worked in parallel once Phase B is complete.
Phases F and G can be worked in parallel once Phase E is complete.
