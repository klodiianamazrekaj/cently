"use client";

import { useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Category, type Transaction } from "./db";
import { monthRange, sameDay } from "./money";

const EMPTY: never[] = [];

// People, accounts and categories, with quick lookups. Updates live as data changes or syncs.
export function useLookups() {
  const rawMembers = useLiveQuery(() => db.members.toArray(), []);
  const rawAccounts = useLiveQuery(() => db.accounts.toArray(), []);
  const rawCategories = useLiveQuery(() => db.categories.toArray(), []);

  const members = useMemo(() => (rawMembers ?? EMPTY).filter((m) => !m.deletedAt).sort((a, b) => a.color.localeCompare(b.color)), [rawMembers]);
  const accounts = useMemo(() => (rawAccounts ?? EMPTY).filter((a) => !a.deletedAt).sort((a, b) => a.kind.localeCompare(b.kind)), [rawAccounts]);
  const categories = useMemo(() => (rawCategories ?? EMPTY).filter((c) => !c.deletedAt), [rawCategories]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const topGroup = useCallback(
    (id: string | null): Category | undefined => {
      const c = id ? catById.get(id) : undefined;
      return c?.parentId ? catById.get(c.parentId) : c;
    },
    [catById]
  );

  return { members, accounts, categories, memberById, accountById, catById, topGroup, ready: !!rawMembers && !!rawCategories };
}
export type Lookups = ReturnType<typeof useLookups>;

// Everything about a month, offset from this one (0 = this month, -1 = last month).
export function monthInfo(offset: number) {
  const now = new Date();
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const { start, end } = monthRange(view);
  const isCurrent = offset === 0;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const lastDay = isCurrent ? now.getDate() : daysInMonth;
  return { now, view, start, end, isCurrent, daysInMonth, lastDay };
}

export function useMonthTxs(offset: number): Transaction[] {
  const { start, end } = monthInfo(offset);
  const rows = useLiveQuery(
    () => db.transactions.where("occurredAt").between(start, end).reverse().filter((t) => !t.deletedAt).toArray(),
    [start, end]
  );
  return rows ?? EMPTY;
}

export const sum = (list: Transaction[]) => list.reduce((a, t) => a + t.amountCents, 0);

const DAY_NAMES = ["E diel", "E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E shtunë"];
const MONTHS_SHORT = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"];
const DAY = 86_400_000;

export type DayGroup = { key: string; label: string; total: number; items: Transaction[] };

// Groups a newest-first list into days: "Sot", "Dje", "E premte, 30 Tet".
export function groupByDay(txs: Transaction[]): DayGroup[] {
  const out: DayGroup[] = [];
  const now = Date.now();
  for (const t of txs) {
    const d = new Date(t.occurredAt);
    const key = d.toDateString();
    let g = out[out.length - 1];
    if (!g || g.key !== key) {
      const label = sameDay(t.occurredAt, now)
        ? "Sot"
        : sameDay(t.occurredAt, now - DAY)
          ? "Dje"
          : `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
      g = { key, label, total: 0, items: [] };
      out.push(g);
    }
    g.items.push(t);
    if (t.kind === "expense") g.total += t.amountCents;
  }
  return out;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return "Natën e mirë";
  if (h < 12) return "Mirëmëngjes";
  if (h < 18) return "Mirëdita";
  return "Mirëmbrëma";
}
