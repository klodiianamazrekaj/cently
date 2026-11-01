-- Cently: our own category colours (the Kategoritë screen).
-- Safe to run more than once.
--
-- color holds a name from CAT_COLORS in lib/categoryStyle.ts (green, teal, cyan, lime,
-- yellow, amber, brown, pink, violet, slate, gray). NULL means the app picks a colour from
-- the category's icon, which is how categories created before this migration look.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS color text;
