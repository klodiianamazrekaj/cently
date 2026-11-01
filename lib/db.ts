import Dexie, { type EntityTable } from "dexie";

// Local mirror of the Supabase schema (supabase/migrations). Amounts are integer cents.
// Everything is saved here first, so the app works offline. synced = 0 means the row
// still has to be sent to Supabase; the sync engine (lib/sync.ts) takes care of it.

export type MemberColor = "blue" | "orange" | "lime" | "ink";
type Syncable = { updatedAt: number; deletedAt: number | null; synced: 0 | 1 };

export interface Member extends Syncable {
  id: string;
  name: string;
  color: MemberColor;
  userId?: string | null; // set once the person has signed in and joined
}

export interface Account extends Syncable {
  id: string;
  name: string;
  kind: "cash" | "card" | "bank" | "savings";
  ownerMemberId: string | null;
}

export interface Category extends Syncable {
  id: string;
  parentId: string | null;
  name: string;
  icon: string;
  color?: string | null; // a name from CAT_COLORS (lib/categoryStyle.ts); null = chosen by icon
  kind: "expense" | "income";
  sortOrder: number;
}

export interface Transaction extends Syncable {
  id: string;
  kind: "expense" | "income";
  amountCents: number;
  categoryId: string | null;
  accountId: string | null;
  paidByMember: string | null;
  scope: "ours" | "mine";
  note: string | null;
  occurredAt: number;
  createdAt: number;
  createdBy?: string | null;
}

export interface Budget extends Syncable {
  id: string;
  categoryId: string;
  month: string; // "2026-11"
  limitCents: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

export const db = new Dexie("cently") as Dexie & {
  members: EntityTable<Member, "id">;
  accounts: EntityTable<Account, "id">;
  categories: EntityTable<Category, "id">;
  transactions: EntityTable<Transaction, "id">;
  budgets: EntityTable<Budget, "id">;
  meta: EntityTable<Meta, "key">;
};

db.version(1).stores({
  members: "id",
  accounts: "id",
  categories: "id, parentId, kind",
  transactions: "id, occurredAt, kind, categoryId, paidByMember, synced",
  budgets: "id, [categoryId+month], month",
});

// v2: every table can sync, plus a small key-value store for the household and sync cursors.
db.version(2)
  .stores({
    members: "id, synced",
    accounts: "id, synced",
    categories: "id, parentId, kind, synced",
    transactions: "id, occurredAt, kind, categoryId, paidByMember, synced",
    budgets: "id, [categoryId+month], month, synced",
    meta: "key",
  })
  .upgrade(async (tx) => {
    for (const name of ["members", "accounts", "categories", "budgets"]) {
      await tx.table(name).toCollection().modify((r: Partial<Syncable>) => {
        r.synced = 0;
        r.deletedAt = r.deletedAt ?? null;
      });
    }
  });

export const uid = () => crypto.randomUUID();

// ---- Household and sync settings stored on this phone ----

export type HouseholdMeta = { householdId: string; memberId: string; userId: string };

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}
export const getHousehold = () => getMeta<HouseholdMeta>("household");

// ---- Tell the sync engine something changed ----

const listeners = new Set<() => void>();
export function onLocalChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed() {
  listeners.forEach((fn) => fn());
}

// ---- First-run setup ----

// Starting categories. Placeholders until the real week of spending.
const SEED: { group: string; icon: string; subs: string[] }[] = [
  { group: "Ushqim", icon: "shopping-basket", subs: ["Market", "Kafe", "Restorant", "Dërgesa"] },
  { group: "Shtëpia", icon: "home", subs: ["Qira", "Rryma", "Uji", "Interneti"] },
  { group: "Transport", icon: "car", subs: ["Karburant", "Taksi", "Parking"] },
  { group: "Personale", icon: "sparkles", subs: ["Veshje", "Kozmetikë", "Shëndet"] },
  { group: "Argëtim", icon: "ticket", subs: ["Dalje", "Abonime", "Dhurata"] },
];

export async function ensureSeed() {
  await db.transaction("rw", db.members, db.accounts, db.categories, async () => {
    const now = Date.now();
    const base = { updatedAt: now, deletedAt: null, synced: 0 as const };
    const existing = await db.members.toArray();
    if (existing.length > 0) {
      // Rename people created by earlier versions on this phone.
      const RENAME: Record<string, string> = { Klodi: "Klodiana", "Unë": "Klodiana", Beni: "Benjamin", Partneri: "Benjamin" };
      for (const m of existing) {
        if (RENAME[m.name]) await db.members.update(m.id, { name: RENAME[m.name], updatedAt: now, synced: 0 });
      }
      return;
    }
    await db.members.bulkAdd([
      { id: uid(), name: "Klodiana", color: "blue", ...base },
      { id: uid(), name: "Benjamin", color: "orange", ...base },
    ]);
    await db.accounts.bulkAdd([
      { id: uid(), name: "Cash", kind: "cash", ownerMemberId: null, ...base },
      { id: uid(), name: "Kartelë", kind: "card", ownerMemberId: null, ...base },
    ]);
    let order = 0;
    for (const g of SEED) {
      const gid = uid();
      await db.categories.add({ id: gid, parentId: null, name: g.group, icon: g.icon, kind: "expense", sortOrder: order++, ...base });
      for (const s of g.subs) {
        await db.categories.add({ id: uid(), parentId: gid, name: s, icon: g.icon, kind: "expense", sortOrder: order++, ...base });
      }
    }
    await db.categories.add({ id: uid(), parentId: null, name: "Rroga", icon: "wallet", kind: "income", sortOrder: order++, ...base });
  });
}

// ---- Expenses ----

export async function addTransaction(t: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "deletedAt" | "synced">) {
  const now = Date.now();
  const hh = await getHousehold();
  const row: Transaction = { ...t, id: uid(), createdAt: now, createdBy: hh?.memberId ?? null, updatedAt: now, deletedAt: null, synced: 0 };
  await db.transactions.add(row);
  changed();
  return row;
}

export async function updateTransaction(id: string, patch: Partial<Omit<Transaction, "id" | "createdAt">>) {
  await db.transactions.update(id, { ...patch, updatedAt: Date.now(), synced: 0 });
  changed();
}

export async function deleteTransaction(id: string) {
  await db.transactions.update(id, { deletedAt: Date.now(), updatedAt: Date.now(), synced: 0 });
  changed();
}

export async function restoreTransaction(id: string) {
  await db.transactions.update(id, { deletedAt: null, updatedAt: Date.now(), synced: 0 });
  changed();
}
