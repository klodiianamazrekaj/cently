# Cently: project notes for Claude

Read this first. It holds the decisions made so far, so you don't have to rediscover them.

## Direction (decided 2 November 2026)

- **Cently is now a native iOS app built with React Native and Expo**, published on the **App Store** first. **Google Play comes later** from the same codebase.
- The **PWA is retired as the product.** Using it from the iPhone home screen was not a good experience. The Next.js app at the repo root stays only as a **working reference** (screens, logic, sync) until the native app replaces it. Don't add new features to it.
- The native app has **not been started yet.** Don't scaffold it until Klodi asks.
- **Apple Developer Program:** enroll early. Developers in Kosovo report problems (region field, payment, ID verification) that can take weeks with Apple support.

## What Cently is

Cently ("Every cent, together" / "Çdo cent, bashkë") is an expense tracker for couples, built by Klodiana (Klodi), a full stack engineer in Kosovo, for herself and her fiancé Benjamin. They are the first users; other couples and roommates (cimera) may come later.

- The core goal is **seeing where every cent goes**. Tracking comes first; splitting is secondary.
- No bank sync: Kosovo has no open banking, so manual entry must be very fast.
- Currency is EUR. Both pay with **cash and card** (accounts "Cash" and "Kartelë"). Both use iPhones.

## Reference apps

- **Luna** (lunabudgeting.com): the polish to aim for; manual budgeting that feels great to use.
- **Honeydue** (honeydue.com): the only active couples-only finance app. Take its couple features (privacy per expense, reactions and comments on expenses, reminders to both partners, mine / ours / partner views), skip its bank linking and ads.
- **Buddy**: shared budgets, invite a member, who paid, settle up. Closest to Cently's idea.
- **bless.**: minimal monochrome icon tiles and a clean icon picker for categories.
- **Quicken**: its long add-transaction form is what *not* to do.
- Also studied on Mobbin: Revolut (Budget, left to spend), Copilot (upcoming bills, net this month), Origin (adding a partner with a colour each), Monarch and Rocket Money (household sharing), KOHO and Wise (splitting).
- Research docs: "Cently: Mobbin references" (https://claude.ai/artifact/13zpx8DrpfTBtssqqdtB2q) and "Honeydue: features, screens and UX" (https://claude.ai/artifact/AhzhLVbJu28rYgAZhWRj2g).

## Working with Klodi

- The **app UI is in Albanian**. Klodi writes in Albanian or English; reply in the language she uses.
- **No em dashes** anywhere: not in UI copy, docs, commit messages or replies.
- When listing a tech stack, list it explicitly, item by item.
- When she asks for a prompt, a plan or a file, give exactly that; don't change code she didn't ask about.
- She prefers to see results: build, test, then summarize briefly. Test on an iPhone-sized simulator (or device) in light and dark before saying something works.
- Commit with clear messages and push to `main`.

## Tech stack (native app, planned)

- **App:** React Native with Expo (managed workflow), TypeScript
- **Navigation:** Expo Router, native bottom tabs plus modal screens for add and edit
- **Local data (offline first):** expo-sqlite on the phone; same model as today: write locally first, sync in the background
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Row Level Security), the existing project and migrations
- **Session storage:** Supabase auth persisted with expo-secure-store
- **Styling:** React Native StyleSheet with Cently tokens in one TypeScript theme file, light and dark via `useColorScheme`
- **Fonts:** Geist and Geist Mono via expo-font
- **Icons:** lucide-react-native (keep the same stored icon keys as the web app's `CATEGORY_ICONS`)
- **Gestures and motion:** react-native-gesture-handler and react-native-reanimated (swipe rows, sheets, count-up numbers)
- **Sheets:** a native bottom sheet for the calendar, pickers and confirmations
- **Haptics:** expo-haptics (keypad, save, swipe actions)
- **Notifications:** expo-notifications (bill reminders, partner activity)
- **Builds and release:** EAS Build, EAS Submit, TestFlight for testing on both phones before App Store review
- **Later:** Android build for Google Play from the same code

Check exact package versions when starting; use current stable releases.

## Repository layout (planned)

- The native app goes in **`mobile/`** (an Expo project) in this same repo.
- The PWA at the root (`app/`, `components/`, `lib/`) stays as reference until `mobile/` replaces it, then it can be removed.
- `supabase/migrations/` is shared and stays the single source of the database schema.
- Port logic rather than rewrite it: `lib/money.ts` (Albanian money and dates), `lib/data.ts` (month math, grouping), `lib/sync.ts` (push, pull, realtime, create and join household), `lib/auth.ts` (Albanian error messages), `lib/categoryStyle.ts` and `CATEGORY_ICONS`. Only the storage layer (Dexie to expo-sqlite) and the UI change.

## Brand and design

Modern, premium, mostly monochrome with one accent. Feels like Luna, not like a bank.

- **Colours:** near-black `#0D0E10` and near-white `#F6F6F3` base; **lime `#C8F04A`** is the only brand accent, used as a fill (add button, selected day, primary buttons); text on lime uses the on-lime token. Income uses the income colour (lime-ink, `#4A7300` light, `#C8F04A` dark). **Spending is ink, never red.** Red (the over token) only for over-budget and destructive actions.
- **Tokens to port** from `app/globals.css`: surfaces (surface, surface-raised, surface-sunken, line), ink and ink-muted, lime set, blue and orange sets (people), over set, the category colour pairs, spacing (4, 8, 12, 16, 24, 32, 48), radius (10, 16, 24, pill).
- **People:** person one is blue, person two is orange (avatars, bars). Always pair colour with a name or initial.
- **Categories:** each top-level category has a colour pair; the category's own `color` wins, otherwise one is picked from its icon (`lib/categoryStyle.ts`). Picker colours: green, teal, cyan, lime, yellow, amber, brown, pink, violet, slate, gray. 51 curated Lucide icons; the keys are stored in the database, never rename one.
- **Type:** Geist for everything; titles 600 to 650 weight with tight negative tracking; amounts always tabular figures, big euros with smaller cents.
- **Money format:** Albanian convention `1.284,50 €`.
- **Tab bar:** floating glass pill a little above the home indicator (native blur), five slots: Kreu, Lëvizjet, lime + in the centre, Analiza, Profili. It never moves between tabs.
- **Logo:** an open ring "C" (a coin) with a lime dot in its opening (the cent). Sources in `brand/`; the app icon is near-black with an off-white ring and lime dot (1024 px source in `brand/icon.svg`).
- **Motion and feel:** subtle rise and fade, count-up numbers, growing bars, haptics on key actions; respect Reduce Motion.
- **Voice:** short, friendly Albanian, talks to "ju" (you two). No guilt about spending. No exclamation marks except real celebrations.

### Design rules: minimal, calm, modern, premium

The app must never look cluttered or "AI generated".

- **Cut text.** No helper hints, no subtitles that repeat the title, no explaining the obvious. Short labels; let hierarchy, spacing and type do the work.
- **Numbers are the hero:** big totals, small cents, tabular figures.
- **Few containers.** No cards with shadows for content. Use whitespace and hairline dividers inset after the icon. No boxes inside boxes.
- **Avoid generic patterns:** coloured icon tiles on every row (rows use a neutral tile with the glyph in the category colour), pill chips everywhere (filters are plain text: active = ink and semibold, inactive = muted), borders or outlines to show selection, percentages and badges on everything, centred hero blocks with lots of copy.
- **Selection** is shown with colour fill or ink weight, never an outline. A chosen category fills its tile with its soft colour.
- **Expense rows:** category icon, name or note, one short muted line (`Klodiana · 16:20`, plus the category when a note is shown), amount. No coloured dots.
- Lime stays rare: the + button, primary buttons, the selected chart bar, today's marker.

## Screens and flows

The native app keeps the flows of the current web app, rebuilt with native components.

1. **Not signed in:** welcome, sign up (name, email, password), log in, confirm email by 6-digit code (or link via deep link `cently://`), forgot password with a code.
2. **Signed in, no household:** auto-load an existing household; otherwise create one (your name and your partner's) or join with a 6-character invite code.
3. **The app** with the tab bar:
   - **Kreu:** "How are we doing this month?" Planned: money left (income minus spending), income / spent / saved, pace vs last month, upcoming bills, today's entries.
   - **Lëvizjet:** the ledger. Month header (swipe to change month, tap for the calendar), a strip of the month's days to filter one day, filters by type and person, search, day groups, half-swipe a row for Ndrysho and Fshi with undo.
   - **+ (add):** the amount is the hero, calculator-style (typing `6` means 6 €, the `,` key starts cents); expense and income as a clear switch; one row of categories (+ creates a new one), subcategories once a category is chosen; one quiet row for date (Sot, Dje, calendar), who paid (defaults to the person on this phone), Cash or Kartelë, note; keypad and save. Editing reopens it prefilled.
   - **Analiza:** understanding over time. Planned: 6-month income vs spending, categories with subcategory drill-down, who paid with 50/50, cash vs card, biggest expenses, short insights.
   - **Profili:** account, Kategoritë (add, rename, reorder, delete, icon and colour; expense and income), household and invite (Fto), sync status, sign out.

## Planned features (not built yet)

In rough priority:

1. **Income as a first-class part** of the app, with income categories (Rroga, Bonus, Freelance, Dhuratë, Tjetër).
2. **Recurring income and bills** (`recurring_rules` exists): repeat monthly from the add screen, entries created when due with a deterministic id per rule and date so two phones never duplicate them, reminders to whoever pays.
3. **Budgets** (`budgets` exists): one household budget, optional limits per category, alerts to both partners.
4. **Couple features from Honeydue:** emoji reactions and short comments on an expense; private expenses ("Vetëm për mua", the `scope` field already exists); a mine / ours / partner view.
5. **Split per expense and settle up** (`transaction_shares`, `settlements` exist).
6. Later: savings goals together, smarter quick-add (frequent categories first, suggest from the note), cash reconciliation, export to a spreadsheet, app lock with Face ID, roommate mode, Google Play.

## Data and sync

- Amounts are **integer cents**. IDs are UUIDs generated on the device.
- Everything is written to the local database first with `synced = 0`; deletes are soft (`deleted_at`).
- Sync: push unsynced rows with upsert, then pull rows changed since the last pull per table using `server_seq` (a server-side counter, so phone clocks don't matter). Realtime triggers a pull; also on reconnect, app foreground and every minute while open.
- A trigger on the server keeps the newest edit (`updated_at`) and stamps `server_seq`.
- Joining a household keeps the phone's existing entries and remaps people, accounts and categories by name.
- Sign out syncs first, warns if changes would be lost, then clears this phone's data.
- Tables: households, members, invites, accounts, categories (two levels via `parent_id`, with `color`), transactions, transaction_shares, budgets, recurring_rules, settlements. RLS: users only see households they are a member of (`is_member`).
- RPCs: `create_household`, `create_invite`, `accept_invite`.

## Supabase

- Project in Frankfurt. The URL and publishable key go in the Expo app's environment (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), never committed. The web app uses `NEXT_PUBLIC_` versions in Vercel and `.env.local`.
- Migrations in `supabase/migrations`, run by hand in the SQL Editor, in order:
  1. `20261101000000_init.sql` (already run; not re-runnable)
  2. `20261101020000_sync.sql` (re-runnable)
  3. `20261102000000_category_color.sql` (re-runnable; adds `categories.color`)
- **Never edit a migration that has been run.** Add a new file with a later timestamp, safe to re-run (`IF NOT EXISTS`, `CREATE OR REPLACE`, guarded `DO` blocks). Tell Klodi which file to run.
- Auth: email and password. "Confirm email" may be off; the app handles both. Email templates should include `{{ .Token }}` for Confirm signup and Reset Password. For the native app, add the `cently://` deep link to Auth > URL Configuration > Redirect URLs.
- Never put the service_role or secret key in the app or the repo.

## App Store requirements to plan for

- Privacy policy URL, and accurate App Privacy answers (email, name, financial entries stored in Supabase).
- **Account deletion inside the app** (Apple requires it when sign-up exists).
- Sign in with Apple is only required if another social login is added; email and password alone don't require it.
- App icon (1024 px, no transparency), screenshots for the required iPhone sizes, Albanian and English store text.
- Test with both phones through TestFlight before submitting for review.

## The web app (reference only)

- Next.js 15, React 19, TypeScript, CSS Modules, Dexie, Supabase, hosted on Vercel from `main` (`vercel.json` forces the Next.js preset; keep Next.js patched or Vercel blocks deploys).
- Key files: `components/AppRoot.tsx` (auth, onboarding or app), `components/auth/`, `components/shell/MainShell.tsx` (tab bar), `components/views/` (Kreu, Lëvizjet, Analiza, Profili), `components/QuickAdd.tsx`, `components/categories/CategoriesScreen.tsx`, `lib/` (db, sync, auth, data, money).
- Run it: `npm install`, `npm run dev`, `npx tsc --noEmit`, `npm run build`.
