-- Cently schema for Supabase (v1)
-- Auth users live in auth.users (Supabase Auth). Row Level Security keeps each household private.
-- Money is always stored as integer cents (amount_cents), currency EUR by default.
-- IDs are UUIDs generated on the device, so expenses logged offline sync without conflicts.
-- Every syncable row has updated_at and deleted_at (soft delete) for last-write-wins sync.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE households (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  currency    char(3) NOT NULL DEFAULT 'EUR',
  kind        text NOT NULL DEFAULT 'couple' CHECK (kind IN ('couple', 'roommates')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A member is a person inside a household. user_id is null until they accept the invite.
CREATE TABLE members (
  id            uuid PRIMARY KEY,
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text NOT NULL,
  color         text NOT NULL CHECK (color IN ('blue', 'orange', 'lime', 'ink')),
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  UNIQUE (household_id, user_id)
);

CREATE TABLE invites (
  token         text PRIMARY KEY,
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL,
  accepted_at   timestamptz
);

-- Where money lives: cash, a card, a shared savings account.
CREATE TABLE accounts (
  id                    uuid PRIMARY KEY,
  household_id          uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  owner_member_id       uuid REFERENCES members(id),   -- null = shared
  name                  text NOT NULL,
  kind                  text NOT NULL CHECK (kind IN ('cash', 'card', 'bank', 'savings')),
  opening_balance_cents bigint NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

-- Two levels: a category with parent_id null is a group (Ushqim), its children are subcategories (Market, Kafe).
CREATE TABLE categories (
  id            uuid PRIMARY KEY,
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES categories(id) ON DELETE CASCADE,
  name          text NOT NULL,
  icon          text NOT NULL DEFAULT 'circle',
  kind          text NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense', 'income')),
  sort_order    int NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- Expenses and income live in one table, told apart by kind.
CREATE TABLE transactions (
  id               uuid PRIMARY KEY,
  household_id     uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('expense', 'income')),
  amount_cents     bigint NOT NULL CHECK (amount_cents > 0),
  category_id      uuid REFERENCES categories(id),
  account_id       uuid REFERENCES accounts(id),
  paid_by_member   uuid REFERENCES members(id),       -- who paid (expense) or who earned (income)
  scope            text NOT NULL DEFAULT 'ours' CHECK (scope IN ('ours', 'mine')),
  note             text,
  occurred_at      timestamptz NOT NULL,
  recurring_id     uuid,
  created_by       uuid REFERENCES members(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX transactions_household_time ON transactions (household_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX transactions_sync ON transactions (household_id, updated_at);

-- How an expense is split. No rows = split by the household's default rule.
CREATE TABLE transaction_shares (
  transaction_id  uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  member_id       uuid NOT NULL REFERENCES members(id),
  share_cents     bigint NOT NULL CHECK (share_cents >= 0),
  PRIMARY KEY (transaction_id, member_id)
);

-- Monthly budget per top-level category.
CREATE TABLE budgets (
  id            uuid PRIMARY KEY,
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month         date NOT NULL,                       -- first day of the month
  limit_cents   bigint NOT NULL CHECK (limit_cents >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  UNIQUE (category_id, month)
);

-- Rent, internet, subscriptions. A job creates the transaction when next_on arrives.
CREATE TABLE recurring_rules (
  id              uuid PRIMARY KEY,
  household_id    uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('expense', 'income')),
  amount_cents    bigint NOT NULL CHECK (amount_cents > 0),
  category_id     uuid REFERENCES categories(id),
  account_id      uuid REFERENCES accounts(id),
  paid_by_member  uuid REFERENCES members(id),
  note            text,
  frequency       text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  next_on         date NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- Settling up between members ("I sent you 40 €").
CREATE TABLE settlements (
  id              uuid PRIMARY KEY,
  household_id    uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  from_member     uuid NOT NULL REFERENCES members(id),
  to_member       uuid NOT NULL REFERENCES members(id),
  amount_cents    bigint NOT NULL CHECK (amount_cents > 0),
  occurred_at     timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- Row Level Security: a signed-in user only sees households they are a member of.

CREATE OR REPLACE FUNCTION public.is_member(hid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE household_id = hid AND user_id = auth.uid() AND deleted_at IS NULL
  );
$$;

ALTER TABLE households       ENABLE ROW LEVEL SECURITY;
ALTER TABLE members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements      ENABLE ROW LEVEL SECURITY;

CREATE POLICY household_rw ON households FOR ALL USING (is_member(id)) WITH CHECK (is_member(id));

CREATE POLICY members_rw         ON members         FOR ALL USING (is_member(household_id)) WITH CHECK (is_member(household_id));
CREATE POLICY invites_rw         ON invites         FOR ALL USING (is_member(household_id)) WITH CHECK (is_member(household_id));
CREATE POLICY accounts_rw        ON accounts        FOR ALL USING (is_member(household_id)) WITH CHECK (is_member(household_id));
CREATE POLICY categories_rw      ON categories      FOR ALL USING (is_member(household_id)) WITH CHECK (is_member(household_id));
CREATE POLICY transactions_rw    ON transactions    FOR ALL USING (is_member(household_id)) WITH CHECK (is_member(household_id));
CREATE POLICY budgets_rw         ON budgets         FOR ALL USING (is_member(household_id)) WITH CHECK (is_member(household_id));
CREATE POLICY recurring_rw       ON recurring_rules FOR ALL USING (is_member(household_id)) WITH CHECK (is_member(household_id));
CREATE POLICY settlements_rw     ON settlements     FOR ALL USING (is_member(household_id)) WITH CHECK (is_member(household_id));
CREATE POLICY shares_rw ON transaction_shares FOR ALL
  USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_id AND is_member(t.household_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_id AND is_member(t.household_id)));

-- Creating a household: the first user becomes its owner in one call, since RLS would otherwise block the first insert.
CREATE OR REPLACE FUNCTION public.create_household(p_name text, p_member_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  INSERT INTO households (name) VALUES (p_name) RETURNING id INTO hid;
  INSERT INTO members (id, household_id, user_id, name, color, role)
  VALUES (gen_random_uuid(), hid, auth.uid(), p_member_name, 'blue', 'owner');
  RETURN hid;
END;
$$;

-- Accepting an invite link: links the signed-in user to the member row the invite was made for.
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO inv FROM invites WHERE token = p_token AND accepted_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'invite invalid or expired'; END IF;
  UPDATE members SET user_id = auth.uid(), updated_at = now() WHERE id = inv.member_id;
  UPDATE invites SET accepted_at = now() WHERE token = p_token;
  RETURN inv.household_id;
END;
$$;

-- Live updates between Klodi's and Beni's phones.
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
