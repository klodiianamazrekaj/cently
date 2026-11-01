"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2 } from "lucide-react";
import { db, deleteTransaction, ensureSeed, type Category } from "@/lib/db";
import { dayLabel, formatCents, monthName, monthRange, timeLabel } from "@/lib/money";
import { QuickAdd } from "@/components/QuickAdd";
import { CategoryIcon } from "@/components/CategoryIcon";
import s from "./page.module.css";

export default function Home() {
  const [adding, setAdding] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);

  useEffect(() => { ensureSeed(); }, []);

  const members = useLiveQuery(() => db.members.toArray(), []) ?? [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const { start, end } = monthRange();
  const txs = useLiveQuery(
    () => db.transactions.where("occurredAt").between(start, end).reverse().filter((t) => !t.deletedAt).toArray(),
    [start, end]
  ) ?? [];

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const topGroup = (id: string | null): Category | undefined => {
    const c = id ? catById.get(id) : undefined;
    return c?.parentId ? catById.get(c.parentId) : c;
  };

  const expenses = txs.filter((t) => t.kind === "expense");
  const spent = expenses.reduce((a, t) => a + t.amountCents, 0);
  const earned = txs.filter((t) => t.kind === "income").reduce((a, t) => a + t.amountCents, 0);

  const byMember = members.map((m) => ({
    m,
    cents: expenses.filter((t) => t.paidByMember === m.id).reduce((a, t) => a + t.amountCents, 0),
  }));

  const byGroup = useMemo(() => {
    const map = new Map<string, { cat: Category; cents: number }>();
    for (const t of expenses) {
      const g = topGroup(t.categoryId);
      if (!g) continue;
      const cur = map.get(g.id) ?? { cat: g, cents: 0 };
      cur.cents += t.amountCents;
      map.set(g.id, cur);
    }
    return [...map.values()].sort((a, b) => b.cents - a.cents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses.length, spent, catById]);

  const days = useMemo(() => {
    const out: { label: string; items: typeof txs }[] = [];
    for (const t of txs) {
      const label = dayLabel(t.occurredAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(t);
      else out.push({ label, items: [t] });
    }
    return out;
  }, [txs]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const maxGroup = byGroup[0]?.cents ?? 0;

  return (
    <main className={s.main}>
      <header className={s.header}>
        <div className={s.brand}>
          <svg viewBox="0 0 64 64" width="22" height="22" aria-hidden>
            <path d="M46.14 17.86 A20 20 0 1 0 46.14 46.14" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
            <circle cx="51" cy="32" r="5.5" fill="var(--lime)" />
          </svg>
          <span>cently</span>
        </div>
        <span className="meta">{monthName()}</span>
      </header>

      <section className={s.hero}>
        <span className="meta">Shpenzuar këtë muaj</span>
        <div className={`${s.total} num`}>{formatCents(spent)}</div>
        {earned > 0 && (
          <div className={`${s.incomeLine} num`}>
            {formatCents(earned, { sign: true })} të ardhura · <span>{formatCents(earned - spent)} mbetur</span>
          </div>
        )}
        {spent > 0 && (
          <div className={s.split} aria-label="Kush pagoi">
            <div className={s.splitBar}>
              {byMember.filter((x) => x.cents > 0).map(({ m, cents }) => (
                <span key={m.id} data-color={m.color} style={{ flexGrow: cents }} />
              ))}
            </div>
            <div className={s.splitLegend}>
              {byMember.map(({ m, cents }) => (
                <span key={m.id} className="num">
                  <i data-color={m.color} />
                  {m.name} {formatCents(cents)}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {byGroup.length > 0 && (
        <section className={s.card}>
          <h2 className={s.cardTitle}>Ku shkuan paret</h2>
          <ul className={s.groups}>
            {byGroup.map(({ cat, cents }, i) => (
              <li key={cat.id}>
                <div className={s.groupHead}>
                  <span className={s.groupName}><span className={s.iconDot}><CategoryIcon name={cat.icon} size={15} /></span>{cat.name}</span>
                  <span className="num">{formatCents(cents)}</span>
                </div>
                <div className={s.bar}><span className={i === 0 ? s.barTop : ""} style={{ width: `${(cents / maxGroup) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={s.list}>
        {days.length === 0 && (
          <div className={s.empty}>
            <p className={s.emptyTitle}>Asnjë shpenzim ende</p>
            <p>Shtyp + dhe shto kafen e parë. Çdo cent, bashkë.</p>
          </div>
        )}
        {days.map((d) => (
          <div key={d.label} className={s.day}>
            <div className={`meta ${s.dayLabel}`}>{d.label}</div>
            <ul className={s.rows}>
              {d.items.map((t) => {
                const c = t.categoryId ? catById.get(t.categoryId) : undefined;
                const g = topGroup(t.categoryId);
                const m = t.paidByMember ? memberById.get(t.paidByMember) : undefined;
                const open = openRow === t.id;
                return (
                  <li key={t.id}>
                    <button className={s.row} onClick={() => setOpenRow(open ? null : t.id)}>
                      <span className={s.iconDot}><CategoryIcon name={g?.icon ?? "circle"} /></span>
                      <span className={s.rowText}>
                        <span className={s.rowName}>{c?.name ?? "Pa kategori"}</span>
                        <span className={s.rowSub}>{t.note ? `${t.note} · ` : ""}{timeLabel(t.occurredAt)}</span>
                      </span>
                      <span className={s.rowRight}>
                        <span className={`${s.rowAmount} num ${t.kind === "income" ? s.inc : ""}`}>
                          {t.kind === "income" ? "+" : ""}{formatCents(t.amountCents)}
                        </span>
                        {m && <span className={s.payer} data-color={m.color}>{m.name.charAt(0)}</span>}
                      </span>
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

      <button className={s.fab} onClick={() => setAdding(true)} aria-label="Shto shpenzim">
        <Plus size={28} strokeWidth={2} />
      </button>

      <QuickAdd open={adding} onClose={() => setAdding(false)} members={members} accounts={accounts} categories={categories} />
    </main>
  );
}
