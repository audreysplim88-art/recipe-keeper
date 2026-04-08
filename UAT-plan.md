# Dodol — User Acceptance Testing Plan

**Version:** 1.0
**App:** Dodol Recipe Keeper
**Platforms:** iOS (native app) · Web (browser)

---

## How to use this document

Work through each section in order. For each test, do the action described, then tick **Pass ✅** or **Fail ❌** and note anything unexpected. You don't need to be technical — describe what you see in plain language.

A few conventions:
- **[iOS]** — test on the iPhone app
- **[Web]** — test on a browser (Chrome or Safari recommended)
- **[Both]** — test on both

Testers should create their own account from scratch to get a clean experience.

---

## Section 1 — Authentication

### 1.1 Sign Up

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 1.1.1 | Open the app for the first time | Sign-in screen appears | | |
| 1.1.2 | Tap "Create account" and enter a new email + password | Account created, redirected to the recipe library | | |
| 1.1.3 | Sign out (Account → Sign out), then sign back in with the same credentials | Successfully signed back in | | |

### 1.2 Sign In / Sign Out

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 1.2.1 | Sign in with a wrong password | Error message shown, not signed in | | |
| 1.2.2 | Sign in with a wrong email | Error message shown, not signed in | | |
| 1.2.3 | Sign out from the Account page | Redirected to sign-in screen | | |

---

## Section 2 — Recipe Library (Home)

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 2.1 | Open the app after signing in | Recipe library loads; shows "No recipes yet" if empty | | |
| 2.2 | Scroll through a library with several recipes | Cards load and scroll smoothly | | |
| 2.3 | Tap a recipe card | Opens the recipe detail page | | |
| 2.4 | Tap "Capture a Recipe" / the + button | Opens the Capture page | | |
| 2.5 | Tap the account icon / "Account" | Opens the Account page | | |

---

## Section 3 — Recipe Capture

### 3.1 Narrate [Both]

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 3.1.1 | Open Capture → select "Narrate" tab | Voice capture UI appears with a microphone button | | |
| 3.1.2 | Tap the mic and describe a simple recipe out loud (e.g. scrambled eggs) | Speech is transcribed into the text area in real time | | |
| 3.1.3 | Tap "Generate Recipe" | Animated loading screen appears, then a recipe preview | | |
| 3.1.4 | Review the preview: check title, ingredients, steps, tips | Recipe looks sensible and matches what was narrated | | |
| 3.1.5 | Check ingredient quantities: tbsp/tsp/g/oz etc. are abbreviated, not spelled out | Abbreviations are used (e.g. "1 tbsp", not "1 tablespoon") | | |
| 3.1.6 | Tap "Save Recipe 💾" | Redirected to the saved recipe's detail page | | |
| 3.1.7 | Navigate back to the library | New recipe appears in the list | | |

### 3.2 Paste [Both]

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 3.2.1 | Open Capture → "Paste" tab | Text area appears | | |
| 3.2.2 | Paste a recipe from a website or document | Text appears in the field | | |
| 3.2.3 | Tap "Generate Recipe" | Recipe preview generated correctly | | |
| 3.2.4 | Edit the recipe title before saving | Title updates | | |
| 3.2.5 | Save the recipe | Saved successfully | | |

### 3.3 URL Import [Both]

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 3.3.1 | Open Capture → "URL" tab | URL input field + Paste button appears | | |
| 3.3.2 | Type or paste a public recipe URL (e.g. a BBC Food recipe) | URL appears in the field | | |
| 3.3.3 | Tap "Import Recipe" | Fetching animation, then recipe preview | | |
| 3.3.4 | Check that the recipe matches the source page | Title, ingredients and steps are accurate | | |
| 3.3.5 | Try a URL behind a login (e.g. a PaywallED site) | Friendly error message, no crash | | |
| 3.3.6 | Try a non-recipe URL (e.g. https://www.bbc.co.uk) | Error message or graceful fallback | | |

### 3.4 Photo [iOS · Web]

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 3.4.1 | Open Capture → "Photo" tab | Photo upload area appears | | |
| 3.4.2 | [iOS] Tap to take a photo of a recipe card or cookbook page | Photo thumbnail appears | | |
| 3.4.3 | [Web] Upload a photo of a recipe from your device | Photo thumbnail appears | | |
| 3.4.4 | Tap "Read Photo" | Loading screen, then recipe preview | | |
| 3.4.5 | Add a second photo (e.g. second page of the recipe) | Both thumbnails visible; up to 5 photos can be added | | |
| 3.4.6 | Check the generated recipe matches the photo content | Accurate extraction | | |

### 3.5 Capture — Edge Cases

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 3.5.1 | Try to generate with an empty paste field | "Generate Recipe" button is disabled / greyed out | | |
| 3.5.2 | Start narrating, close app mid-narration [iOS], re-open | Banner offers to restore the unsaved narration | | |
| 3.5.3 | Generate a recipe, then tap "← Recipe Library" without saving | Warning prompt: "You have unsaved changes — are you sure?" | | |
| 3.5.4 | Tap "Try Again" on the preview screen | Returns to capture mode, previous input cleared | | |

---

## Section 4 — Recipe Detail

### 4.1 Viewing

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 4.1.1 | Open any saved recipe | Full recipe shown: description, category, dietary tags, allergens, servings, times, ingredients, steps, tips | | |
| 4.1.2 | Tap "← Recipe Library" | Returns to the library | | |
| 4.1.3 | Check dietary tags (e.g. for a vegan recipe) | Correct tags shown as badges | | |
| 4.1.4 | Check allergen labels (e.g. for a recipe with dairy) | Correct allergens listed | | |

### 4.2 Editing

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 4.2.1 | Tap the edit (pencil) button on a recipe | Recipe enters edit mode | | |
| 4.2.2 | Change the recipe title | Title updates | | |
| 4.2.3 | Edit an ingredient quantity | Change saved correctly | | |
| 4.2.4 | Add a new step | Step appears in the list | | |
| 4.2.5 | Save changes | Confirmation; updated recipe shown | | |

### 4.3 Deleting

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 4.3.1 | Tap the delete button on a recipe | Confirmation prompt appears | | |
| 4.3.2 | Confirm deletion | Redirected to library; recipe gone | | |

### 4.4 Sous Chef button

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 4.4.1 | [Free user] Tap "Cook with Sous Chef" | Paywall screen appears (not the cooking session) | | |
| 4.4.2 | [Free user] Tap "← Back to Recipe" on the paywall | Returns to recipe detail | | |
| 4.4.3 | [Paid user] Tap "Cook with Sous Chef" | Sous Chef waiting screen appears | | |

---

## Section 5 — Sous Chef (Paid Feature)

*Complete this section as a paid user, or ask the developer for a test account.*

### 5.1 Starting a session

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 5.1.1 | Open Sous Chef for any recipe | Waiting screen shows recipe name and "Start Cooking" button | | |
| 5.1.2 | Check the back button label | Shows "← Back to Recipe" | | |
| 5.1.3 | Tap "Start Cooking" | Session begins; Sous Chef greets you and reads the first message aloud | | |
| 5.1.4 | Check that speech plays automatically | Voice reads the welcome message | | |

### 5.2 Voice and conversation

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 5.2.1 | Ask a question by tapping the mic | Speech transcribed; Sous Chef responds with relevant advice | | |
| 5.2.2 | Ask "What's the next step?" | Sous Chef reads the next instruction aloud | | |
| 5.2.3 | Ask "What are the ingredients?" | Sous Chef lists them | | |
| 5.2.4 | Ask a follow-up question (e.g. "How long should I stir?") | Contextually relevant answer | | |
| 5.2.5 | [iOS] Use the volume buttons during speech | Volume changes (not the ringer) | | |
| 5.2.6 | [iOS] Put the phone down; does speech continue? | Speech plays through the speaker even with screen off | | |

### 5.3 Exiting

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 5.3.1 | Tap "← Back to Recipe" during a session | Returns to the recipe detail page | | |

---

## Section 6 — iOS Share Extension

*iPhone only. Tests the ability to save recipes from Safari or other apps directly into Dodol.*

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 6.1 | Open a recipe page in Safari | Page loads | | |
| 6.2 | Tap the iOS Share button (box with arrow) | Share sheet appears | | |
| 6.3 | Find and tap "Dodol" in the share sheet | Dodol share extension opens showing the URL | | |
| 6.4 | Tap "Copy Link & Open Dodol" | "Link copied" confirmation appears in the share sheet | | |
| 6.5 | Open the Dodol app | App opens | | |
| 6.6 | Navigate to Capture → URL tab | Paste button is visible | | |
| 6.7 | Tap the "Paste" button | The recipe URL populates the input field | | |
| 6.8 | Tap "Import Recipe" | Recipe is successfully imported | | |

---

## Section 7 — Account Page

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 7.1 | Open Account page | Shows your name, email, member since date | | |
| 7.2 | Check navigation header | "← Recipe Library" on the left, "Account" title on the right | | |
| 7.3 | Tap the edit (✏️) button next to your name | Name input field appears | | |
| 7.4 | Change your name and save | Name updates; "Name updated ✓" confirmation shown | | |
| 7.5 | [Free user] Check subscription section | Shows "Free Plan" badge and recipe usage bar (e.g. "2 / 3") | | |
| 7.6 | [Free user] Tap "Upgrade to Pro" | Paywall / pricing screen opens | | |
| 7.7 | [Paid user] Check subscription section | Shows "Pro — Monthly" or "Pro — Annual" badge with renewal date | | |
| 7.8 | [Paid user] Tap "Manage subscription" | Stripe billing portal opens | | |

---

## Section 8 — Paywall & Subscription

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 8.1 | [Free user] Save 3 recipes | All 3 save successfully | | |
| 8.2 | [Free user] Try to save a 4th recipe | Paywall modal appears | | |
| 8.3 | Close the paywall modal | Returned to capture; recipe not saved | | |
| 8.4 | On the paywall, view the plan options | Monthly and annual pricing both shown | | |
| 8.5 | [Optional — real payment] Select a plan and complete checkout | Redirected back to app with "Welcome to Dodol Pro" banner | | |
| 8.6 | After upgrading, save a 4th recipe | Saves successfully with no paywall | | |

---

## Section 9 — Navigation Consistency Check

Run through these quickly to verify labels are consistent.

| # | Page | Back button text | Header title | Result |
|---|------|-----------------|--------------|--------|
| 9.1 | Recipe Detail | ← Recipe Library | *(none)* | |
| 9.2 | Capture a Recipe | ← Recipe Library | Capture a Recipe | |
| 9.3 | Account | ← Recipe Library | Account | |
| 9.4 | Sous Chef — waiting | ← Back to Recipe | *(none / recipe name)* | |
| 9.5 | Sous Chef — cooking | ← Back to Recipe | *(session header)* | |
| 9.6 | Sous Chef — paywall (free user) | ← Back to Recipe | *(none)* | |

---

## Section 10 — Performance & Stability

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 10.1 | [iOS] Background the app mid-capture and return | State preserved | | |
| 10.2 | Import a recipe from a slow/complex URL | Loading indicator shown; either succeeds or shows a friendly timeout message (not a crash) | | |
| 10.3 | Try narrating for 2+ minutes continuously | Transcription continues; no crash | | |
| 10.4 | Have a 10+ message Sous Chef conversation | Session remains responsive throughout | | |
| 10.5 | Kill and relaunch the app [iOS] | Returns to library; no data loss | | |

---

## Section 11 — Error States

| # | Action | Expected result | Result | Notes |
|---|--------|-----------------|--------|-------|
| 11.1 | Turn on Airplane Mode and try to import a URL | Friendly "Network error" message, no crash | | |
| 11.2 | Turn on Airplane Mode and try to save a recipe | Friendly error message | | |
| 11.3 | Navigate to `/recipe/fake-id` | "Recipe not found" screen with back button | | |

---

## Feedback Summary

After completing your testing, please fill out this section:

**Overall impression** (1–5 stars): ___

**Top 3 things that worked well:**
1.
2.
3.

**Top 3 things that felt confusing or broken:**
1.
2.
3.

**Any additional comments:**


---

*Thank you for testing Dodol! Your feedback helps make the app better.*
