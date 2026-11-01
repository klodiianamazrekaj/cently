import Dexie, { type EntityTable } from "dexie";

// Local mirror of the server schema (db/schema.sql). Amounts are integer cents.
// synced = 0 means the row still needs to be pushed to the server.

export type MemberColor = "blue" | "orange" | "lime" | "ink";

export interface Member {
  id: string;
  name: string;
  color: MemberColor;
  updatedAt: number;
}

export interface Account {
  id: string;
  name: string;
  kind: "cash" | "card" | "bank" | "savings";
  ownerMemberId: string | null;
  updatedAt: number;
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  icon: string;
  kind: "expense" | "income";
  sortOrder: number;
  updatedAt: number;
}

export interface Transaction {
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
  updatedAt: number;
  deletedAt: number | null;
  synced: 0 | 1;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string; // "2026-11"
  limitCents: number;
  updatedAt: number;
}

export const db = new Dexie("cently") as Dexie & {
  members: EntityTable<Member, "id">;
  accounts: EntityTable<Account, "id">;
  categories: EntityTable<Category, "id">;
  transactions: EntityTable<Transaction, "id">;
  budgets: EntityTable<Budget, "id">;
};

db.version(1).stores({
  members: "id",
  accounts: "id",
  categories: "id, parentId, kind",
  transactions: "id, occurredAt, kind, categoryId, paidByMember, synced",
  budgets: "id, [categoryId+month], month",
});

export const uid = () => crypto.randomUUID();

// Starting setup: Klodi and Beni, cash and card. Categories are placeholders until the real week of spending.
const SEED: { group: string; icon: string; subs: string[] }[] = [
  { group: "Ushqim", icon: "shopping-basket", subs: ["Market", "Kafe", "Restorant", "Dërgesa"] },
  { group: "Shtëpia", icon: "home", subs: ["Qira", "Rryma", "Uji", "Interneti"] },
  { group: "Transport", icon: "car", subs: ["Karburant", "Taksi", "Parking"] },
  { group: "Personale", icon: "sparkles", subs: ["Veshje", "Kozmetikë", "Shëndet"] },
  { group: "Argëtim", icon: "ticket", subs: ["Dalje", "Abonime", "Dhurata"] },
];

export async function ensureSeed() {
  await db.transaction("rw", db.members, db.accounts, db.categories, async () => {
    if ((await db.members.count()) > 0) return;
    const now = Date.now();
    await db.members.bulkAdd([
      { id: uid(), name: "Klodi", color: "blue", updatedAt: now },
      { id: uid(), name: "Beni", color: "orange", updatedAt: now },
    ]);
    await db.accounts.bulkAdd([
      { id: uid(), name: "Cash", kind: "cash", ownerMemberId: null, updatedAt: now },
      { id: uid(), name: "Kartelë", kind: "card", ownerMemberId: null, updatedAt: now },
    ]);
    let order = 0;
    for (const g of SEED) {
      const gid = uid();
      await db.categories.add({ id: gid, parentId: null, name: g.group, icon: g.icon, kind: "expense", sortOrder: order++, updatedAt: now });
      for (const s of g.subs) {
        await db.categories.add({ id: uid(), parentId: gid, name: s, icon: g.icon, kind: "expense", sortOrder: order++, updatedAt: now });
      }
    }
    await db.categories.add({ id: uid(), parentId: null, name: "Rroga", icon: "wallet", kind: "income", sortOrder: order++, updatedAt: now });
  });
}

export async function addTransaction(t: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "deletedAt" | "synced">) {
  const now = Date.now();
  const row: Transaction = { ...t, id: uid(), createdAt: now, updatedAt: now, deletedAt: null, synced: 0 };
  await db.transactions.add(row);
  return row;
}

export async function deleteTransaction(id: string) {
  await db.transactions.update(id, { deletedAt: Date.now(), updatedAt: Date.now(), synced: 0 });
}
