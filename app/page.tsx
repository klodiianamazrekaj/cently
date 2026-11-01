"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2, X } from "lucide-react";
import { db, deleteTransaction, ensureSeed, type Category, type Transaction } from "@/lib/db";
import { formatCents, monthName, monthRange, timeLabel } from "@/lib/money";
import { catColor } from "@/lib/categoryStyle";
import { QuickAdd } from "@/components/QuickAdd";
import { CatTile } from "@/components/CatTile";
import { Amount } from "@/components/Amount";
import s from "./page.module.css";

const DAY_NAMES = ["E diel", "E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E shtunë"];

export default function Home() {
  const [adding, setAdding] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [day, setDay] = useState<number | null>(null);

  useEffect(() => { ensureSeed(); }, []);

  const rawMembers = useLiveQuery(() => db.members.toArray(), []);
  const members = useMemo(() => [...(rawMembers ?? [])].sort((a, b) => a.color.localeCompare(b.color)), [rawMembers]);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const now = new Date();
  const { start, end } = monthRange(now);
  const txs = useLiveQuery(
    () => db.transactions.where("occurredAt").between(start, end).reverse().filter((t) => !t.deletedAt).toArray(),
    [start, end]
  ) ?? [];

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const topGroup = (id: string | null): Category | undefined => {
    const c = id ? catById.get(id) : undefined;
    return c?.parentId ? catById.get(c.parentId) : c;
  };

  const expenses = txs.filter((t) => t.kind === "expense");
  const spent = sum(expenses);
  const earned = sum(txs.filter((t) => t.kind === "income"));

  // Daily totals for the chart
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  const perDay = useMemo(() => {
    const arr = new Array(daysInMonth).fill(0);
    for (const t of expenses) arr[new Date(t.occurredAt).getDate() - 1] += t.amountCents;
    return arr;
  }, [expenses, daysInMonth]);
  const maxDay = Math.max(...perDay, 1);
  const average = Math.round(spent / today);

  const byMember = members.map((m) => ({ m, cents: sum(expenses.filter((t) => t.paidByMember === m.id)) }));

  const byGroup = useMemo(() => {
    const map = new Map<string, { cat: Category; cents: number; count: number }>();
    for (const t of expenses) {
      const g = topGroup(t.categoryId);
      if (!g) continue;
      const cur = map.get(g.id) ?? { cat: g, cents: 0, count: 0 };
      cur.cents += t.amountCents;
      cur.count += 1;
      map.set(g.id, cur);
    }
    return [...map.values()].sort((a, b) => b.cents - a.cents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, catById]);

  const visible = day ? txs.filter((t) => new Date(t.occurredAt).getDate() === day) : txs;
  const groups = useMemo(() => {
    const out: { key: number; label: string; total: number; items: Transaction[] }[] = [];
    for (const t of visible) {
      const d = new Date(t.occurredAt);
      const key = d.getDate();
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        const label = key === today ? "Sot" : key === today - 1 ? "Dje" : `${DAY_NAMES[d.getDay()]}, ${key}`;
        g = { key, label, total: 0, items: [] };
        out.push(g);
      }
      g.items.push(t);
      if (t.kind === "expense") g.total += t.amountCents;
    }
    return out;
  }, [visible, today]);

  const heroSub = day
    ? `${day} ${monthName(now).toLowerCase()}: ${formatCents(perDay[day - 1])}`
    : `Sot ${formatCents(perDay[today - 1])} · mesatarisht ${formatCents(average)} në ditë`;

  return (
    <main className={s.main}>
      <header className={`${s.top} rise`}>
        <div className={s.couple}>
          <div className={s.avatars}>
            {members.map((m) => (
              <span key={m.id} className={s.avatar} data-color={m.color}>{m.name.charAt(0)}</span>
            ))}
          </div>
          <span className={s.coupleName}>{members.map((m) => m.name).join(" & ")}</span>
        </div>
        <span className={s.monthPill}>{monthName(now)} {now.getFullYear()}</span>
      </header>

      <section className={`${s.hero} rise`} style={{ animationDelay: "40ms" }}>
        <p className={s.heroLabel}>Shpenzuar këtë muaj</p>
        <Amount cents={spent} size={56} animate />
        <p className={s.heroSub}>{heroSub}</p>
        {earned > 0 && !day && (
          <p className={s.heroIncome}>
            <Amount cents={earned} size={14} sign="+" /> të ardhura · {formatCents(Math.max(earned - spent, 0))} mbetur
          </p>
        )}

        <div className={s.chart} role="group" aria-label="Shpenzimet sipas ditëve">
          {perDay.map((c, i) => {
            const d = i + 1;
            const future = d > today;
            const selected = day === d || (!day && d === today);
            return (
              <button
                key={d}
                className={s.barSlot}
                onClick={() => !future && setDay(day === d ? null : d)}
                disabled={future}
                aria-label={`${d}: ${formatCents(c)}`}
              >
                <span
                  className={`${s.bar} ${selected ? s.barOn : ""} ${future ? s.barFuture : ""}`}
                  style={{ height: future ? 4 : Math.max(4, (c / maxDay) * 88), animationDelay: `${i * 12}ms` }}
                />
              </button>
            );
          })}
        </div>
        <div className={s.chartAxis}>
          {[1, 8, 15, 22, daysInMonth].map((d) => <span key={d} className="num">{d}</span>)}
        </div>
      </section>

      <section className={`${s.people} rise`} style={{ animationDelay: "80ms" }}>
        {byMember.map(({ m, cents }) => {
          const pct = spent ? Math.round((cents / spent) * 100) : 0;
          return (
            <div key={m.id} className={s.person}>
              <div className={s.personTop}>
                <span className={s.avatar} data-color={m.color}>{m.name.charAt(0)}</span>
                <span className={s.personPct}>{pct}%</span>
              </div>
              <span className={s.personName}>{m.name}</span>
              <Amount cents={cents} size={22} animate />
              <span className={s.personBar}><i data-color={m.color} style={{ width: `${pct}%` }} /></span>
            </div>
          );
        })}
      </section>

      {byGroup.length > 0 && (
        <section className={`${s.section} rise`} style={{ animationDelay: "120ms" }}>
          <h2 className={s.h2}>Ku shkuan paret</h2>
          <ul className={s.card}>
            {byGroup.map(({ cat, cents, count }) => (
              <li key={cat.id} className={s.catRow}>
                <CatTile icon={cat.icon} size={40} />
                <div className={s.catMain}>
                  <div className={s.catLine}>
                    <span className={s.catName}>{cat.name}</span>
                    <Amount cents={cents} size={16} />
                  </div>
                  <div className={s.catLine}>
                    <span className={s.track}><i style={{ width: `${(cents / spent) * 100}%`, background: catColor(cat.icon).fg }} /></span>
                    <span className={s.catCount}>{count} {count === 1 ? "shpenzim" : "shpenzime"}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${s.section} rise`} style={{ animationDelay: "160ms" }}>
        <div className={s.h2Row}>
          <h2 className={s.h2}>{day ? `${day} ${monthName(now)}` : "Lëvizjet"}</h2>
          {day && (
            <button className={`${s.clear} press`} onClick={() => setDay(null)}>
              <X size={14} strokeWidth={2} /> Të gjitha
            </button>
          )}
        </div>

        {groups.length === 0 && (
          <div className={s.empty}>
            <CatTile icon="wallet" size={56} />
            <p className={s.emptyTitle}>{day ? "Asnjë shpenzim këtë ditë" : "Asnjë shpenzim ende"}</p>
            <p>Shtyp butonin poshtë dhe shto kafen e parë.</p>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.key} className={s.dayGroup}>
            <div className={s.dayHead}>
              <span>{g.label}</span>
              <span className="num">{formatCents(g.total)}</span>
            </div>
            <ul className={s.card}>
              {g.items.map((t) => {
                const c = t.categoryId ? catById.get(t.categoryId) : undefined;
                const grp = topGroup(t.categoryId);
                const m = t.paidByMember ? memberById.get(t.paidByMember) : undefined;
                const acc = accounts.find((a) => a.id === t.accountId);
                const open = openRow === t.id;
                return (
                  <li key={t.id}>
                    <button className={s.tx} onClick={() => setOpenRow(open ? null : t.id)}>
                      <CatTile icon={grp?.icon} size={40} />
                      <span className={s.txText}>
                        <span className={s.txName}>{t.note || c?.name || "Pa kategori"}</span>
                        <span className={s.txSub}>
                          {m && <i className={s.dot} data-color={m.color} />}
                          {[m?.name, t.note ? c?.name : null, acc?.name, timeLabel(t.occurredAt)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <Amount cents={t.amountCents} size={16} sign={t.kind === "income" ? "+" : undefined} className={t.kind === "income" ? s.inc : ""} />
                    </button>
                    {open && (
                      <button className={s.delete} onClick={() => { deleteTransaction(t.id); setOpenRow(null); }}>
                        <Trash2 size={16} strokeWidth={1.75} /> Fshi
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <div className={s.dock}>
        <button className={`${s.add} press`} onClick={() => setAdding(true)}>
          <Plus size={22} strokeWidth={2.25} /> Shto shpenzim
        </button>
      </div>

      <QuickAdd open={adding} onClose={() => setAdding(false)} members={members} accounts={accounts} categories={categories} />
    </main>
  );
}

function sum(list: Transaction[]) {
  return list.reduce((a, t) => a + t.amountCents, 0);
}
