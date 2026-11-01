"use client";

import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { db, ensureSeed, getHousehold, getMeta, onLocalChange, setMeta, type HouseholdMeta, type Transaction } from "./db";
import { supabase } from "./supabase";

// How it works
// - Every change is saved on the phone first (IndexedDB) with synced = 0.
// - push(): sends unsynced rows to Supabase with upsert. Supabase keeps the newest edit.
// - pull(): asks Supabase for rows changed since the last pull, using server_seq per table.
// - Realtime: when the other phone changes something, Supabase notifies us and we pull.
// - Runs again when the app opens, comes back online, or every minute while open.

type Row = Record<string, unknown>;
const iso = (ms: number | null | undefined) => (ms == null ? null : new Date(ms).toISOString());
const ms = (v: unknown) => (v == null ? null : Date.parse(String(v)));

type TableDef = {
  local: "members" | "accounts" | "categories" | "transactions" | "budgets";
  toRemote: (r: Row, hid: string) => Row;
  fromRemote: (r: Row) => Row;
};

const TABLES: TableDef[] = [
  {
    local: "members",
    // user_id and role are only set by the server (create_household, accept_invite).
    toRemote: (r, hid) => ({ id: r.id, household_id: hid, name: r.name, color: r.color, updated_at: iso(r.updatedAt as number), deleted_at: iso(r.deletedAt as number | null) }),
    fromRemote: (r) => ({ id: r.id, name: r.name, color: r.color, userId: r.user_id ?? null, updatedAt: ms(r.updated_at), deletedAt: ms(r.deleted_at) }),
  },
  {
    local: "accounts",
    toRemote: (r, hid) => ({ id: r.id, household_id: hid, name: r.name, kind: r.kind, owner_member_id: r.ownerMemberId ?? null, updated_at: iso(r.updatedAt as number), deleted_at: iso(r.deletedAt as number | null) }),
    fromRemote: (r) => ({ id: r.id, name: r.name, kind: r.kind, ownerMemberId: r.owner_member_id ?? null, updatedAt: ms(r.updated_at), deletedAt: ms(r.deleted_at) }),
  },
  {
    local: "categories",
    toRemote: (r, hid) => ({ id: r.id, household_id: hid, parent_id: r.parentId ?? null, name: r.name, icon: r.icon, color: r.color ?? null, kind: r.kind, sort_order: r.sortOrder, updated_at: iso(r.updatedAt as number), deleted_at: iso(r.deletedAt as number | null) }),
    fromRemote: (r) => ({ id: r.id, parentId: r.parent_id ?? null, name: r.name, icon: r.icon, color: r.color ?? null, kind: r.kind, sortOrder: r.sort_order, updatedAt: ms(r.updated_at), deletedAt: ms(r.deleted_at) }),
  },
  {
    local: "transactions",
    toRemote: (r, hid) => ({
      id: r.id, household_id: hid, kind: r.kind, amount_cents: r.amountCents, category_id: r.categoryId ?? null,
      account_id: r.accountId ?? null, paid_by_member: r.paidByMember ?? null, scope: r.scope ?? "ours", note: r.note ?? null,
      occurred_at: iso(r.occurredAt as number), created_at: iso(r.createdAt as number), created_by: r.createdBy ?? null,
      updated_at: iso(r.updatedAt as number), deleted_at: iso(r.deletedAt as number | null),
    }),
    fromRemote: (r) => ({
      id: r.id, kind: r.kind, amountCents: Number(r.amount_cents), categoryId: r.category_id ?? null, accountId: r.account_id ?? null,
      paidByMember: r.paid_by_member ?? null, scope: r.scope, note: r.note ?? null, occurredAt: ms(r.occurred_at), createdAt: ms(r.created_at),
      createdBy: r.created_by ?? null, updatedAt: ms(r.updated_at), deletedAt: ms(r.deleted_at),
    }),
  },
  {
    local: "budgets",
    toRemote: (r, hid) => ({ id: r.id, household_id: hid, category_id: r.categoryId, month: `${r.month}-01`, limit_cents: r.limitCents, updated_at: iso(r.updatedAt as number), deleted_at: iso(r.deletedAt as number | null) }),
    fromRemote: (r) => ({ id: r.id, categoryId: r.category_id, month: String(r.month).slice(0, 7), limitCents: Number(r.limit_cents), updatedAt: ms(r.updated_at), deletedAt: ms(r.deleted_at) }),
  },
];

// ---------------- Status that the UI can show ----------------

export type SyncState = {
  phase: "off" | "idle" | "syncing" | "offline" | "error";
  lastSyncedAt: number | null;
  pending: number;
  error: string | null;
};
let state: SyncState = { phase: "off", lastSyncedAt: null, pending: 0, error: null };
const subs = new Set<() => void>();
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
export function useSyncState() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => state,
    () => state
  );
}

// ---------------- Push and pull ----------------

async function push(hid: string) {
  if (!supabase) return;
  for (const t of TABLES) {
    let rows = (await db.table(t.local).where("synced").equals(0).toArray()) as Row[];
    if (!rows.length) continue;
    // Parent categories before subcategories, so references exist on the server.
    if (t.local === "categories") rows = rows.sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId));
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const payload = batch.map((r) => t.toRemote(r, hid));
      let { error } = await supabase.from(t.local).upsert(payload, { onConflict: "id" });
      let withoutColor = false;
      if (error && t.local === "categories" && /color/i.test(error.message)) {
        // The color column comes from migration 20261102000000_category_color.sql. Until it has
        // been run, keep syncing without it; rows with a colour stay pending and go up afterwards.
        withoutColor = true;
        ({ error } = await supabase.from(t.local).upsert(payload.map(({ color: _c, ...rest }) => rest), { onConflict: "id" }));
      }
      if (error) throw new Error(`${t.local}: ${error.message}`);
      // Mark as synced only if nothing changed on the phone while we were sending.
      await db.transaction("rw", db.table(t.local), async () => {
        for (const r of batch) {
          if (withoutColor && r.color) continue;
          await db.table(t.local).where("id").equals(r.id as string).and((x: Row) => x.updatedAt === r.updatedAt).modify({ synced: 1 });
        }
      });
    }
  }
}

async function pull(hid: string) {
  if (!supabase) return;
  const cursors = (await getMeta<Record<string, number>>("cursors")) ?? {};
  for (const t of TABLES) {
    let from = Math.max(0, (cursors[t.local] ?? 0) - 20); // small overlap so nothing is ever skipped
    for (;;) {
      const { data, error } = await supabase
        .from(t.local)
        .select("*")
        .eq("household_id", hid)
        .gt("server_seq", from)
        .order("server_seq", { ascending: true })
        .limit(500);
      if (error) throw new Error(`${t.local}: ${error.message}`);
      if (!data?.length) break;
      await db.transaction("rw", db.table(t.local), async () => {
        for (const remote of data as Row[]) {
          const incoming = t.fromRemote(remote);
          const local = (await db.table(t.local).get(incoming.id as string)) as Row | undefined;
          // A newer edit that is still waiting on this phone wins; it will be pushed next.
          if (local && local.synced === 0 && (local.updatedAt as number) > (incoming.updatedAt as number)) continue;
          await db.table(t.local).put({ ...local, ...incoming, synced: 1 });
        }
      });
      from = Number((data[data.length - 1] as Row).server_seq);
      cursors[t.local] = Math.max(cursors[t.local] ?? 0, from);
      if (data.length < 500) break;
    }
  }
  await setMeta("cursors", cursors);
}

export async function countPending() {
  let n = 0;
  for (const t of TABLES) n += await db.table(t.local).where("synced").equals(0).count();
  return n;
}

// ---------------- Scheduler ----------------

let hh: HouseholdMeta | null = null;
let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let channel: RealtimeChannel | null = null;
let cleanups: (() => void)[] = [];

export async function syncNow() {
  if (!supabase || !hh) return;
  if (running) { again = true; return; }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    set({ phase: "offline", pending: await countPending() });
    return;
  }
  running = true;
  set({ phase: "syncing", error: null });
  try {
    await push(hh.householdId);
    await pull(hh.householdId);
    set({ phase: "idle", lastSyncedAt: Date.now(), pending: await countPending(), error: null });
  } catch (e) {
    set({ phase: navigator.onLine ? "error" : "offline", error: e instanceof Error ? e.message : String(e), pending: await countPending() });
  } finally {
    running = false;
    if (again) { again = false; requestSync(200); }
  }
}

export function requestSync(delay = 500) {
  if (!hh) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; syncNow(); }, delay);
}

export async function startSync() {
  stopSync();
  hh = (await getHousehold()) ?? null;
  if (!supabase || !hh) { set({ phase: "off" }); return; }
  const hid = hh.householdId;

  channel = supabase.channel(`household:${hid}`);
  for (const t of TABLES) {
    channel.on("postgres_changes", { event: "*", schema: "public", table: t.local, filter: `household_id=eq.${hid}` }, () => requestSync(150));
  }
  channel.subscribe();

  const onOnline = () => requestSync(100);
  const onVisible = () => { if (document.visibilityState === "visible") requestSync(100); };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const interval = setInterval(() => requestSync(0), 60_000);
  const off = onLocalChange(() => requestSync(400));
  cleanups = [
    () => window.removeEventListener("online", onOnline),
    () => window.removeEventListener("offline", onOnline),
    () => document.removeEventListener("visibilitychange", onVisible),
    () => clearInterval(interval),
    () => { off(); },
  ];
  await syncNow();
}

export function stopSync() {
  cleanups.forEach((f) => f());
  cleanups = [];
  if (channel && supabase) supabase.removeChannel(channel);
  channel = null;
  hh = null;
  set({ phase: "off" });
}

// ---------------- Creating and joining a household ----------------

// Klodiana: turns the data already on this phone into the shared household.
export async function createHousehold(userId: string, myMemberId: string) {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar");
  const me = await db.members.get(myMemberId);
  if (!me) throw new Error("Anëtari nuk u gjet");
  const members = await db.members.filter((m) => !m.deletedAt).toArray();
  const householdId = crypto.randomUUID();
  const { error } = await supabase.rpc("create_household", {
    p_household_id: householdId,
    p_name: members.map((m) => m.name).join(" & "),
    p_member_id: me.id,
    p_member_name: me.name,
    p_color: me.color,
  });
  if (error) throw new Error(error.message);
  await db.members.update(me.id, { userId });
  // Everything on this phone gets uploaded.
  for (const t of TABLES) await db.table(t.local).toCollection().modify({ synced: 0 });
  await setMeta("cursors", {});
  await setMeta("household", { householdId, memberId: me.id, userId } satisfies HouseholdMeta);
  await startSync();
}

// Benjamin (or a new phone): uses the shared household and keeps any expenses already
// on this phone by matching people, accounts and categories by name.
export async function adoptHousehold(householdId: string, userId: string) {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar");
  const fetchAll = async (table: string) => {
    const { data, error } = await supabase!.from(table).select("*").eq("household_id", householdId);
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  };
  const [rMembers, rAccounts, rCategories] = await Promise.all([fetchAll("members"), fetchAll("accounts"), fetchAll("categories")]);
  const me = rMembers.find((m) => m.user_id === userId);
  if (!me) throw new Error("Nuk u gjet anëtarësimi në këtë shtëpi");

  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const lMembers = await db.members.toArray();
  const lAccounts = await db.accounts.toArray();
  const lCategories = await db.categories.toArray();
  const lCatById = new Map(lCategories.map((c) => [c.id, c]));
  const rCatById = new Map(rCategories.map((c) => [c.id as string, c]));
  const catKey = (name: unknown, parentName: unknown) => `${norm(parentName)}/${norm(name)}`;

  const memberMap = new Map<string, string>();
  for (const m of lMembers) {
    const r = rMembers.find((x) => norm(x.name) === norm(m.name));
    if (r) memberMap.set(m.id, r.id as string);
  }
  const accountMap = new Map<string, string>();
  for (const a of lAccounts) {
    const r = rAccounts.find((x) => norm(x.name) === norm(a.name)) ?? rAccounts.find((x) => x.kind === a.kind);
    if (r) accountMap.set(a.id, r.id as string);
  }
  const remoteCatByKey = new Map(
    rCategories.map((c) => [catKey(c.name, c.parent_id ? rCatById.get(c.parent_id as string)?.name : ""), c.id as string])
  );
  const categoryMap = new Map<string, string>();
  for (const c of lCategories) {
    const parentName = c.parentId ? lCatById.get(c.parentId)?.name : "";
    const r = remoteCatByKey.get(catKey(c.name, parentName));
    if (r) categoryMap.set(c.id, r);
  }

  const toLocal = (def: TableDef, rows: Row[]) => rows.map((r) => ({ ...def.fromRemote(r), synced: 1 }));
  const def = (name: TableDef["local"]) => TABLES.find((t) => t.local === name)!;

  await db.transaction("rw", [db.members, db.accounts, db.categories, db.transactions, db.budgets, db.meta], async () => {
    // Keep this phone's expenses, pointing them at the shared people, accounts and categories.
    const txs = await db.transactions.toArray();
    for (const t of txs) {
      const patch: Partial<Transaction> = {
        paidByMember: t.paidByMember ? memberMap.get(t.paidByMember) ?? null : null,
        accountId: t.accountId ? accountMap.get(t.accountId) ?? null : null,
        categoryId: t.categoryId ? categoryMap.get(t.categoryId) ?? null : null,
        createdBy: t.createdBy ? memberMap.get(t.createdBy) ?? (me.id as string) : (me.id as string),
        synced: 0,
      };
      await db.transactions.update(t.id, patch);
    }
    await db.budgets.clear();
    await db.members.clear();
    await db.accounts.clear();
    await db.categories.clear();
    await db.members.bulkPut(toLocal(def("members"), rMembers) as never[]);
    await db.accounts.bulkPut(toLocal(def("accounts"), rAccounts) as never[]);
    await db.categories.bulkPut(toLocal(def("categories"), rCategories) as never[]);
    await db.meta.put({ key: "cursors", value: {} });
    await db.meta.put({ key: "household", value: { householdId, memberId: me.id as string, userId } satisfies HouseholdMeta });
  });
  await startSync();
}

export async function joinWithCode(code: string, userId: string) {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar");
  const { data, error } = await supabase.rpc("accept_invite", { p_token: code });
  if (error) throw new Error(error.message.includes("invalid") ? "Kodi nuk është i saktë ose ka skaduar" : error.message);
  await adoptHousehold(data as string, userId);
}

// After signing in: is this account already part of a household?
export async function findMyHousehold(userId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("members").select("household_id").eq("user_id", userId).is("deleted_at", null).limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0]?.household_id as string) ?? null;
}

export async function createInvite(memberId: string) {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar");
  const { data, error } = await supabase.rpc("create_invite", { p_member_id: memberId });
  if (error) throw new Error(error.message);
  return data as string;
}

// Signing out: try to send anything still waiting, then remove this household's data from the
// phone, so the next person who signs in here starts clean. Returns how many changes were lost.
export async function signOutAndClear(opts: { force?: boolean } = {}) {
  if (hh && navigator.onLine) {
    try { await syncNow(); } catch {}
  }
  const lost = await countPending();
  if (lost > 0 && !opts.force) return lost;
  stopSync();
  if (supabase) await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  await db.transaction("rw", [db.members, db.accounts, db.categories, db.transactions, db.budgets, db.meta], async () => {
    await Promise.all([db.members.clear(), db.accounts.clear(), db.categories.clear(), db.transactions.clear(), db.budgets.clear(), db.meta.clear()]);
  });
  await ensureSeed();
  return 0;
}
