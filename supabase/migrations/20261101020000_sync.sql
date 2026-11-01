-- Cently sync (v2): run this after 20261101000000_init.sql
--
-- What it adds:
-- 1. server_seq: a server-side change counter on every synced table, so each phone can ask
--    "what changed since I last looked?" without trusting phone clocks.
-- 2. Last write wins: an older edit arriving late never overwrites a newer one.
-- 3. create_household that accepts the IDs the phone already uses, so local data uploads as is.
-- 4. Invite codes for Benjamin, and live updates for all shared tables.

CREATE SEQUENCE IF NOT EXISTS sync_seq;

ALTER TABLE households ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE members         ADD COLUMN IF NOT EXISTS server_seq bigint NOT NULL DEFAULT nextval('sync_seq');
ALTER TABLE accounts        ADD COLUMN IF NOT EXISTS server_seq bigint NOT NULL DEFAULT nextval('sync_seq');
ALTER TABLE categories      ADD COLUMN IF NOT EXISTS server_seq bigint NOT NULL DEFAULT nextval('sync_seq');
ALTER TABLE transactions    ADD COLUMN IF NOT EXISTS server_seq bigint NOT NULL DEFAULT nextval('sync_seq');
ALTER TABLE budgets         ADD COLUMN IF NOT EXISTS server_seq bigint NOT NULL DEFAULT nextval('sync_seq');
ALTER TABLE recurring_rules ADD COLUMN IF NOT EXISTS server_seq bigint NOT NULL DEFAULT nextval('sync_seq');
ALTER TABLE settlements     ADD COLUMN IF NOT EXISTS server_seq bigint NOT NULL DEFAULT nextval('sync_seq');

CREATE INDEX IF NOT EXISTS members_seq         ON members (household_id, server_seq);
CREATE INDEX IF NOT EXISTS accounts_seq        ON accounts (household_id, server_seq);
CREATE INDEX IF NOT EXISTS categories_seq      ON categories (household_id, server_seq);
CREATE INDEX IF NOT EXISTS transactions_seq    ON transactions (household_id, server_seq);
CREATE INDEX IF NOT EXISTS budgets_seq         ON budgets (household_id, server_seq);

-- Stamps every write with a new server_seq, and ignores updates older than what is stored.
CREATE OR REPLACE FUNCTION public.sync_stamp()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.updated_at < OLD.updated_at THEN
      RETURN OLD;                       -- stale edit from a phone that was offline: keep the newer row
    END IF;
    IF NEW.household_id <> OLD.household_id THEN
      RAISE EXCEPTION 'rows cannot move between households';
    END IF;
  END IF;
  NEW.server_seq := nextval('sync_seq');
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['members','accounts','categories','transactions','budgets','recurring_rules','settlements'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_sync_stamp ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_sync_stamp BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.sync_stamp()', t, t);
  END LOOP;
END;
$$;

-- Create a household using the IDs already on the phone. Safe to call twice.
DROP FUNCTION IF EXISTS public.create_household(text, text);
CREATE OR REPLACE FUNCTION public.create_household(
  p_household_id uuid,
  p_name text,
  p_member_id uuid,
  p_member_name text,
  p_color text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;

  IF EXISTS (SELECT 1 FROM households WHERE id = p_household_id) THEN
    IF is_member(p_household_id) THEN RETURN p_household_id; END IF;
    RAISE EXCEPTION 'household already exists';
  END IF;

  INSERT INTO households (id, name, created_by) VALUES (p_household_id, p_name, auth.uid());
  INSERT INTO members (id, household_id, user_id, name, color, role, updated_at)
  VALUES (p_member_id, p_household_id, auth.uid(), p_member_name, p_color, 'owner', now());
  RETURN p_household_id;
END;
$$;

-- A short code Klodiana gives Benjamin. Valid for 7 days, linked to his member row.
CREATE OR REPLACE FUNCTION public.create_invite(p_member_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  hid uuid;
  code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
BEGIN
  SELECT household_id INTO hid FROM members WHERE id = p_member_id AND deleted_at IS NULL;
  IF hid IS NULL OR NOT is_member(hid) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF EXISTS (SELECT 1 FROM members WHERE id = p_member_id AND user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'member already joined';
  END IF;

  -- Reuse a code that is still valid.
  SELECT token INTO code FROM invites
  WHERE member_id = p_member_id AND accepted_at IS NULL AND expires_at > now()
  ORDER BY expires_at DESC LIMIT 1;
  IF code IS NOT NULL THEN RETURN code; END IF;

  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM invites WHERE token = code);
  END LOOP;

  INSERT INTO invites (token, household_id, member_id, expires_at)
  VALUES (code, hid, p_member_id, now() + interval '7 days');
  RETURN code;
END;
$$;

-- Joining with a code: links the signed-in user to that member row.
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT * INTO inv FROM invites
  WHERE token = upper(trim(p_token)) AND accepted_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'invite invalid or expired'; END IF;
  IF EXISTS (SELECT 1 FROM members WHERE id = inv.member_id AND user_id IS NOT NULL AND user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'member already joined';
  END IF;
  UPDATE members SET user_id = auth.uid(), updated_at = now() WHERE id = inv.member_id;
  UPDATE invites SET accepted_at = now() WHERE token = inv.token;
  RETURN inv.household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_household(uuid, text, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_invite(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM anon;
REVOKE ALL ON FUNCTION public.is_member(uuid) FROM anon;

-- Live updates for every shared table.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['members','accounts','categories','transactions','budgets'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
