# Cently: project notes for Claude

Read this first. It holds the decisions made so far, so you don't have to rediscover them.

## What Cently is

Cently ("Every cent, together" / "Çdo cent, bashkë") is an expense tracker for couples, built by Klodiana (Klodi), a full stack engineer in Kosovo, for herself and her fiancé Benjamin. They are the first users; other couples and roommates (cimera) may come later.

- The core goal is **seeing where every cent goes**. Tracking comes first; splitting is secondary.
- Reference app: **Luna** (lunabudgeting.com), a beautifully designed manual budgeting app. Cently aims for Luna's polish plus a shared household for two.
- No bank sync: Kosovo has no open banking, so manual entry must be very fast.
- Currency is EUR. Both pay with **cash and card** (accounts "Cash" and "Kartelë").
- **PWA first** (installed from Safari with Add to Home Screen). A native iOS app may come later with React Native and Expo. Apple Developer enrollment from Kosovo has known problems, which is one reason the PWA comes first.

## Working with Klodi

- The **app UI is in Albanian**. Klodi writes in Albanian or English; reply in the language she uses.
- **No em dashes** anywhere: not in UI copy, docs, commit messages or replies.
- When listing a tech stack, list it explicitly, item by item.
- She prefers to see results: build, test, push, then summarize briefly. Test touch flows at iPhone size before saying something works.
- Commit with clear messages and push to `main` (Vercel deploys from `main`).

## Tech stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** CSS Modules, Cently design tokens as CSS variables in `app/globals.css` (light and dark via `prefers-color-scheme`)
- **Fonts:** Geist and Geist Mono (`geist` package)
- **Icons:** Lucide (`lucide-react`)
- **Calendar:** react-day-picker v9 with the Albanian locale, styled with tokens
- **Offline data:** IndexedDB through Dexie (`dexie`, `dexie-react-hooks`)
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Row Level Security)
- **Hosting:** Vercel. `vercel.json` forces the Next.js framework preset.
- Keep Next.js on a patched version: Vercel blocks deploys of vulnerable Next.js releases.

## Brand and design

Modern, premium, mostly monochrome with one accent. Feels like Luna, not like a bank.

- **Colours:** near-black `#0D0E10` and near-white `#F6F6F3` base; **lime `#C8F04A`** is the only brand accent, used as a fill (add button, selected day, active chips, primary buttons); text on lime is `--on-lime`. Income uses `--income` (lime-ink). **Spending is ink, never red.** Red (`--over`) only for over-budget and destructive actions.
- **People:** person one is `blue`, person two is `orange` (dots, avatars, bars). Always pair colour with a name or initial.
- **Categories:** each top-level category has a colour pair (`--cat-<name>-bg` / `--cat-<name>`, light and dark in `globals.css`). The category's own `color` wins; without one, `lib/categoryStyle.ts` picks one from its icon. Picker colours: `CAT_COLORS` (green, teal, cyan, lime, yellow, amber, brown, pink, violet, slate, gray). Icons: `CATEGORY_ICONS` in `components/CategoryIcon.tsx` (51 curated Lucide icons; keys are stored, never rename one).
- **Type:** Geist for everything; titles 600 to 650 weight with tight negative tracking; amounts always `tabular-nums`, big euros with smaller cents (`components/Amount.tsx`).
- **Money format:** Albanian convention `1.284,50 €` (see `lib/money.ts`).
- **Shapes:** radius tokens `--radius-sm` 10, `md` 16, `lg` 24, `pill`. Floating glass tab bar (a rounded pill, 8px above the iPhone home indicator).
- **Logo:** an open ring "C" (a coin) with a lime dot in its opening (the cent). `components/Mark.tsx`, icons in `public/icons`, sources in `brand/`.
- **Motion:** subtle rise and fade on screens, count-up numbers, growing bars; always respect `prefers-reduced-motion`.
- **Voice:** short, friendly Albanian, talks to "ju" (you two). No guilt about spending. No exclamation marks except real celebrations.

### Design rules: minimal, calm, modern, premium

The app must never look cluttered or "AI generated".

- **Cut text.** No helper hints, no subtitles that repeat the title, no explaining the obvious. Short labels; let hierarchy, spacing and type do the work.
- **Numbers are the hero:** big totals, small cents, tabular figures (`Amount`).
- **Few containers.** No cards with shadows for content. Use whitespace and hairline dividers (`.list` in `ui.module.css`, inset after the icon). No boxes inside boxes.
- **Avoid generic patterns:** coloured icon tiles on every row (rows use a neutral tile with the glyph in the category colour, `CatTile`), pill chips everywhere (filters and tabs are plain text, active = ink and semibold, inactive = muted), borders or outlines to show selection, percentages and badges on everything, centred hero blocks with lots of copy.
- **Selection** is shown with colour fill or ink weight, never an outline. A chosen category fills its tile with its soft colour.
- **Expense rows:** category icon, name or note, one short muted line (`Klodiana · 16:20`, plus the category when a note is shown), amount. No coloured dots.
- Lime stays rare: the + button, primary buttons, the selected chart bar, today's caret.

## App structure

`components/AppRoot.tsx` decides what to show:

1. Not signed in: `components/auth/AuthFlow.tsx` (welcome, sign up, log in, confirm email by code or link, forgot password with code, new password after a recovery link)
2. Signed in, no household on this phone: `components/auth/Onboarding.tsx` (auto-loads an existing household, otherwise create one with both names, or join with a 6-character invite code)
3. Household on this phone: `components/shell/MainShell.tsx` with a bottom tab bar. The app stays usable offline even if the session expired; Profili then offers "Hyr përsëri".

Tabs (single page, tab state in `MainShell`, no routes, so it works offline):

- **Kreu** (`views/HomeView.tsx`): month total as the hero, daily bars (tap a day), who paid (split bar), top 4 categories, latest 5 expenses
- **Lëvizjet** (`views/TransactionsView.tsx`): month header, a swipeable strip of the month's days (dot = has expenses, today in lime ink; tap to filter, tap again or "Të gjitha" to clear), total, text filters by type and person, search behind an icon, day groups
- **+** (centre): opens `components/QuickAdd.tsx`
- **Analiza** (`views/StatsView.tsx`): total and change vs last month, donut by category with subcategory drill-down, who paid with 50/50, cash vs card, biggest expenses
- **Profili** (`views/ProfileView.tsx`): account, Kategoritë, household members, invite code (Fto), sync status, sign out

Shared pieces: `views/parts.tsx` (`MonthHeader`: swipe left or right to change month, tap the month name for the calendar; TxList with half-swipe, TxRow, SyncBadge dot, Empty), `components/SwipeRow.tsx` (swipe left reveals Ndrysho and Fshi), `components/DateSheet.tsx` (calendar; `quick` adds a Dje button), `lib/data.ts` (useLookups, monthInfo, useMonthTxs, groupByDay).

Quick-add (`QuickAdd.tsx`): the amount is the hero (calculator-style: typing `6` means 6 €, the `,` key starts cents), then one row of categories (+ at the end creates a new one and selects it), subcategories as plain text once a category is chosen, then one quiet row: date (Sot, Dje or calendar in the sheet), who paid (tap to switch, defaults to the person on this phone), Cash or Kartelë (tap to switch), note. Then the keypad and save. Editing reopens it prefilled. Delete shows an undo toast.

Kategoritë (`components/categories/CategoriesScreen.tsx`, from Profili and from the + in quick-add): expense and income tabs; add, rename, reorder (Rendit) and delete categories and subcategories; pick an icon and a colour. Edits are a draft saved with Ruaj. Deleting is soft: a subcategory's expenses move to its parent; a category with expenses asks where they should go (another category or Pa kategori). Helpers in `lib/db.ts`: `createCategory`, `updateCategory`, `setCategoryOrder`, `categoryUsage`, `deleteCategory`.

## Data and sync

- Amounts are **integer cents**. IDs are UUIDs generated on the device.
- Everything is written to IndexedDB first (`lib/db.ts`, Dexie schema v3) with `synced = 0`; use the helpers there (`addTransaction`, `updateTransaction`, `deleteTransaction`, `restoreTransaction`), which also notify the sync engine. Deletes are soft (`deletedAt`).
- `lib/sync.ts`: push unsynced rows with upsert, then pull rows changed since the last pull per table using `server_seq` (a server-side counter, so phone clocks don't matter), Realtime triggers a pull, also on reconnect, app focus and every minute.
- A trigger on the server keeps the newest edit (`updated_at`) and stamps `server_seq`.
- Joining a household keeps the phone's existing expenses and remaps people, accounts and categories by name.
- Sign out syncs first, warns if changes would be lost, then clears this phone's data.
- Tables: households, members, invites, accounts, categories (two levels via `parent_id`), transactions, transaction_shares, budgets, recurring_rules, settlements. RLS: users only see households they are a member of (`is_member`).
- RPCs: `create_household`, `create_invite`, `accept_invite`.

## Supabase

- Project in Frankfurt. URL and publishable key are in Vercel env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and locally in `.env.local` (not committed).
- Migrations in `supabase/migrations`, run by hand in the SQL Editor, in order:
  1. `20261101000000_init.sql` (already run; not re-runnable)
  2. `20261101020000_sync.sql` (re-runnable)
  3. `20261102000000_category_color.sql` (re-runnable; adds `categories.color`). Until it has run, sync skips the colour and coloured categories stay pending.
- **Never edit a migration that has been run.** Add a new file with a later timestamp, and make it safe to re-run (`IF NOT EXISTS`, `CREATE OR REPLACE`, guarded `DO` blocks).
- Auth: email + password. "Confirm email" may be off; the app handles both. Email templates should include `{{ .Token }}` for Confirm signup and Reset Password. URL Configuration: Site URL is the Vercel URL, Redirect URLs include it with `/**`.
- Never put the service_role or secret key in the app or the repo.

## PWA notes

- `public/manifest.webmanifest`, `public/sw.js` (bump `VERSION` when shipping notable changes so phones refresh the cache), icons in `public/icons`.
- On iPhone, the home screen app has storage separate from Safari, and email links open in Safari, which is why codes are offered alongside links.
- After a deploy, fully close and reopen the home screen app to get the new version.

## Running and checking

```bash
npm install
npm run dev          # http://localhost:3000
npx tsc --noEmit     # type check
npm run build        # must pass before pushing
```

## Ideas and next steps (not built yet)

- Monthly budgets per category (the `budgets` table exists) with "how much is left"
- Recurring expenses (rent, internet, subscriptions; `recurring_rules` exists)
- Savings goals together (butter-yellow celebration moments)
- Smarter quick-add: most used categories first, suggest a category from the note
- Cash reconciliation (wallet vs app)
- Daily logging reminder (web push for installed PWAs)
- Export to a spreadsheet
- Roommate mode with custom splits and settling up (`transaction_shares`, `settlements` exist)
- A proper email sender (custom SMTP with a domain) if more users join
