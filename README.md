# Cently

Every cent, together. Çdo cent, bashkë.

An installable web app (PWA) for Klodi and Beni to log every expense in seconds, see where the money goes each month, and who paid what.

## Tech stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **Styling:** CSS Modules with the Cently design tokens as CSS variables (light and dark)
- **Fonts:** Geist and Geist Mono (`geist` package, self-hosted)
- **Icons:** Lucide
- **PWA:** web app manifest, service worker (`public/sw.js`), home screen icons
- **Offline data:** IndexedDB through Dexie, every expense is saved on the phone first
- **Backend and database:** Supabase (PostgreSQL, Auth, Realtime, Row Level Security)
- **Hosting:** Vercel

## What works now

- Home: this month's total, income and what's left, Klodi vs Beni split, spending by category, recent expenses by day
- Quick-add: keypad, expense or income, category and subcategory, who paid, cash or card, optional note
- Tap an expense to delete it
- Works offline and installs to the home screen

Data is stored only on the device for now. Sync to Supabase is the next step.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional until sync is added
npm run dev
```

## Supabase setup

1. Create a project at supabase.com (region: Frankfurt, closest to Kosovo).
2. Open the SQL editor and run `supabase/migrations/20261101000000_init.sql`.
3. Copy the project URL and anon key into `.env.local` (and into Vercel's environment variables).
4. In Authentication, enable Email (magic link).

## Install on iPhone

Open the deployed URL in Safari, tap Share, then "Add to Home Screen".

## Structure

```
app/                 pages and global styles (tokens)
components/          QuickAdd sheet, icons, service worker registration
lib/db.ts            local IndexedDB schema and seed (Klodi, Beni, Cash, Kartelë)
lib/money.ts         Albanian money and date formatting
lib/supabase.ts      Supabase client
supabase/migrations  database schema with Row Level Security
public/              manifest, service worker, icons
brand/               source SVGs for the app icon
```
