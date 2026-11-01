# Cently

Every cent, together. Çdo cent, bashkë.

An installable web app (PWA) for Klodiana and Benjamin to log every expense in seconds, see where the money goes each month, and who paid what.

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **Calendar:** react-day-picker, styled with the Cently tokens
- **Styling:** CSS Modules with the Cently design tokens as CSS variables (light and dark)
- **Fonts:** Geist and Geist Mono (`geist` package, self-hosted)
- **Icons:** Lucide
- **PWA:** web app manifest, service worker (`public/sw.js`), home screen icons
- **Offline data:** IndexedDB through Dexie, every expense is saved on the phone first
- **Backend and database:** Supabase (PostgreSQL, Auth, Realtime, Row Level Security)
- **Hosting:** Vercel

## What works now

- Welcome, sign up and log in with email and password; email confirmation by code or link; forgot password
- Onboarding: create the household (your name and your partner's) or join with an invite code
- Bottom tab bar with four screens and a central add button:
  - **Kreu:** month total, daily chart, who paid, top categories, latest expenses
  - **Lëvizjet:** all expenses by day, month switching, search, filters by type and person
  - **Analiza:** donut by category with subcategories, change vs last month, daily average, 50/50 split, cash vs card, biggest expenses
  - **Profili:** account, household members, invite code, sync status, sign out
- Add: calculator-style amount, expense or income, category and subcategory, who paid, cash or card, note, date (today, yesterday, or calendar)
- Half-swipe an expense to edit or delete, with undo
- Two-way sync with Supabase: offline first, live updates between phones, newest edit wins
- Installs to the home screen and works offline

## How sync works

1. Every change is saved on the phone first (IndexedDB) and marked unsynced.
2. The sync engine (`lib/sync.ts`) upserts unsynced rows to Supabase, then pulls rows changed since the last pull using `server_seq`, a server-side counter, so phone clocks never matter.
3. Supabase Realtime tells the other phone something changed, and it pulls right away.
4. A trigger on the server ignores edits older than what is stored, so an offline phone can't overwrite newer data.
5. When joining with an invite code, expenses already on the phone are kept and matched to the shared people, accounts and categories by name.

## Run locally

```bash
npm install
cp .env.example .env.local   # Supabase URL and key, needed for sync
npm run dev
```

## Supabase setup

1. Create a project at supabase.com (region: Frankfurt, closest to Kosovo).
2. In the SQL editor, run the migrations in order:
   - `supabase/migrations/20261101000000_init.sql`
   - `supabase/migrations/20261101020000_sync.sql`
3. Copy the project URL and publishable (anon) key into `.env.local` and into Vercel's environment variables.
4. Authentication > Sign In / Providers > Email: enabled. "Confirm email" can stay on (the app accepts the code or the link) or be turned off.
5. Authentication > URL Configuration:
   - Site URL: the Vercel production URL, e.g. `https://cently.vercel.app`
   - Redirect URLs: `https://cently.vercel.app/**` and `http://localhost:3000/**`
6. Authentication > Emails > Templates: add `{{ .Token }}` to **Confirm signup** and **Reset Password** so the emails contain a code. On iPhone, links open in Safari rather than the home screen app, so the code is the smoother path.

## Install on iPhone

Open the deployed URL in Safari, tap Share, then "Add to Home Screen".

## Structure

```
app/                 pages and global styles (tokens)
components/AppRoot   decides: welcome and auth, onboarding, or the app
components/auth/     AuthFlow (sign up, log in, confirm, reset), Onboarding
components/shell/    MainShell with the bottom tab bar
components/views/    Kreu, Lëvizjet, Analiza, Profili and shared list parts
components/          QuickAdd, DateSheet (calendar), SwipeRow, icons
lib/db.ts            local IndexedDB schema and seed (Klodiana, Benjamin, Cash, Kartelë)
lib/money.ts         Albanian money and date formatting
lib/supabase.ts      Supabase client
lib/sync.ts          sync engine: push, pull, realtime, create and join household
lib/auth.ts          sign up, log in, confirmation, password reset, Albanian errors
lib/data.ts          shared hooks: people, accounts, categories, month data
supabase/migrations  database schema with Row Level Security
public/              manifest, service worker, icons
brand/               source SVGs for the app icon
```
