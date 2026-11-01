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

- Home: month total, daily chart (tap a day), Klodiana vs Benjamin, spending by category, expenses by day, month switching
- Add: calculator-style amount, expense or income, category and subcategory, who paid, cash or card, note, date (today, yesterday, or calendar)
- Half-swipe an expense to edit or delete, with undo
- Sign in with a 6-digit email code, create the household, invite Benjamin with a code
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
4. Authentication > Sign In / Providers: Email enabled.
5. Authentication > Emails: in both **Magic Link** and **Confirm signup** templates, include `{{ .Token }}` so the email contains the 6-digit code.
6. Authentication > URL Configuration: Site URL = the Vercel URL.

## Install on iPhone

Open the deployed URL in Safari, tap Share, then "Add to Home Screen".

## Structure

```
app/                 pages and global styles (tokens)
components/          QuickAdd, DateSheet (calendar), SwipeRow, AccountSheet, icons
lib/db.ts            local IndexedDB schema and seed (Klodiana, Benjamin, Cash, Kartelë)
lib/money.ts         Albanian money and date formatting
lib/supabase.ts      Supabase client
lib/sync.ts          sync engine: push, pull, realtime, create and join household
lib/auth.ts          email code sign-in
supabase/migrations  database schema with Row Level Security
public/              manifest, service worker, icons
brand/               source SVGs for the app icon
```
