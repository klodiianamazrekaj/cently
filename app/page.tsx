"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { db, deleteTransaction, ensureSeed, restoreTransaction, type Category, type Transaction } from "@/lib/db";
import { formatCents, monthName, monthRange, sameDay, timeLabel } from "@/lib/money";
import { catColor } from "@/lib/categoryStyle";
import { QuickAdd } from "@/components/QuickAdd";
import { CatTile } from "@/components/CatTile";
import { Amount } from "@/components/Amount";
import { SwipeRow } from "@/components/SwipeRow";
import s from "./page.module.css";

const DAY_NAMES = ["E diel", "E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E shtunë"];
const DAY = 86_400_000;

export default function Home() {
  const [sheet, setSheet] = useState<{ editing: Transaction | null } | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [offset, setOffset] = useState(0); // 0 = this month, -1 = last month
  const [undo, setUndo] = useState<{ id: string; key: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { ensureSeed(); }, []);

  const rawMembers = useLiveQuery(() => db.members.toArray(), []);
  const members = useMemo(() => [...(rawMembers ?? [])].sort((a, b) => a.color.localeCompare(b.color)), [rawMembers]);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];

  const now = new Date();
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const isCurrent = offset === 0;
  const { start, end } = monthRange(view);
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
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const lastDay = isCurrent ? now.getDate() : daysInMonth; // days after this are in the future
  const perDay = useMemo(() => {
    const arr = new Array(daysInMonth).fill(0);
    for (const t of expenses) arr[new Date(t.occurredAt).getDate() - 1] += t.amountCents;
    return arr;
  }, [expenses, daysInMonth]);
  const maxDay = Math.max(...perDay, 1);
  const average = Math.round(spent / lastDay);

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
    const nowTs = Date.now();
    for (const t of visible) {
      const d = new Date(t.occurredAt);
      const key = d.getDate();
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        const label = sameDay(t.occurredAt, nowTs) ? "Sot" : sameDay(t.occurredAt, nowTs - DAY) ? "Dje" : `${DAY_NAMES[d.getDay()]}, ${key}`;
        g = { key, label, total: 0, items: [] };
        out.push(g);
      }
      g.items.push(t);
      if (t.kind === "expense") g.total += t.amountCents;
    }
    return out;
  }, [visible]);

  const changeMonth = (delta: number) => {
    setOffset((o) => Math.min(0, o + delta));
    setDay(null);
    setOpenRow(null);
  };

  // After saving, show the month the expense belongs to (e.g. yesterday was last month).
  const onSaved = (ts: number) => {
    const d = new Date(ts);
    setOffset((d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
  };

  const remove = (id: string) => {
    deleteTransaction(id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ id, key: Date.now() });
    undoTimer.current = setTimeout(() => setUndo(null), 4500);
  };

  const heroSub = day
    ? `${day} ${monthName(view).toLowerCase()}: ${formatCents(perDay[day - 1])}`
    : isCurrent
      ? `Sot ${formatCents(perDay[lastDay - 1])} · mesatarisht ${formatCents(average)} në ditë`
      : `Mesatarisht ${formatCents(average)} në ditë`;

  return (
    <main className={s.main} onClick={() => openRow && setOpenRow(null)}>
      <header className={`${s.top} rise`}>
        <div className={s.couple}>
          <div className={s.avatars}>
            {members.map((m) => (
              <span key={m.id} className={s.avatar} data-color={m.color}>{m.name.charAt(0)}</span>
            ))}
          </div>
          <span className={s.coupleName}>{members.map((m) => m.name).join(" & ")}</span>
        </div>
        <div className={s.monthNav}>
          <button className="press" onClick={() => changeMonth(-1)} aria-label="Muaji i kaluar"><ChevronLeft size={18} strokeWidth={2} /></button>
          <span className={s.monthLabel}>{monthName(view)}{view.getFullYear() !== now.getFullYear() ? ` ${view.getFullYear()}` : ""}</span>
          <button className="press" onClick={() => changeMonth(1)} disabled={isCurrent} aria-label="Muaji tjetër"><ChevronRight size={18} strokeWidth={2} /></button>
        </div>
      </header>

      <section key={offset} className={`${s.hero} rise`} style={{ animationDelay: "40ms" }}>
        <p className={s.heroLabel}>{isCurrent ? "Shpenzuar këtë muaj" : `Shpenzuar në ${monthName(view).toLowerCase()}`}</p>
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
            const future = d > lastDay;
            const selected = day === d || (!day && isCurrent && d === lastDay);
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
          <h2 className={s.h2}>{day ? `${day} ${monthName(view)}` : "Lëvizjet"}</h2>
          {day ? (
            <button className={`${s.clear} press`} onClick={() => setDay(null)}>
              <X size={14} strokeWidth={2} /> Të gjitha
            </button>
          ) : txs.length > 0 ? (
            <span className={s.hint}>Rrëshqit majtas për të ndryshuar</span>
          ) : null}
        </div>

        {groups.length === 0 && (
          <div className={s.empty}>
            <CatTile icon="wallet" size={56} />
            <p className={s.emptyTitle}>{day ? "Asnjë shpenzim këtë ditë" : isCurrent ? "Asnjë shpenzim ende" : "Asnjë shpenzim këtë muaj"}</p>
            {isCurrent && <p>Shtyp butonin poshtë dhe shto kafen e parë.</p>}
          </div>
        )}

        {groups.map((g) => (
          <div key={g.key} className={s.dayGroup}>
            <div className={s.dayHead}>
              <span>{g.label}</span>
              <span className="num">{formatCents(g.total)}</span>
            </div>
            <ul className={s.card} onClick={(e) => e.stopPropagation()}>
              {g.items.map((t) => {
                const c = t.categoryId ? catById.get(t.categoryId) : undefined;
                const grp = topGroup(t.categoryId);
                const m = t.paidByMember ? memberById.get(t.paidByMember) : undefined;
                const acc = accounts.find((a) => a.id === t.accountId);
                return (
                  <li key={t.id}>
                    <SwipeRow
                      open={openRow === t.id}
                      onOpenChange={(o) => setOpenRow(o ? t.id : null)}
                      onTap={() => setSheet({ editing: t })}
                      onEdit={() => setSheet({ editing: t })}
                      onDelete={() => remove(t.id)}
                    >
                      <div className={s.tx}>
                        <CatTile icon={grp?.icon} size={40} />
                        <span className={s.txText}>
                          <span className={s.txName}>{t.note || c?.name || "Pa kategori"}</span>
                          <span className={s.txSub}>
                            {m && <i className={s.dot} data-color={m.color} />}
                            {[m?.name, t.note ? c?.name : null, acc?.name, timeLabel(t.occurredAt)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <Amount cents={t.amountCents} size={16} sign={t.kind === "income" ? "+" : undefined} className={t.kind === "income" ? s.inc : ""} />
                      </div>
                    </SwipeRow>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <div className={s.dock}>
        {undo ? (
          <div key={undo.key} className={s.toast} role="status">
            <span>Shpenzimi u fshi</span>
            <button
              className="press"
              onClick={() => {
                restoreTransaction(undo.id);
                setUndo(null);
                if (undoTimer.current) clearTimeout(undoTimer.current);
              }}
            >
              Zhbëj
            </button>
          </div>
        ) : (
          <button className={`${s.add} press`} onClick={() => setSheet({ editing: null })}>
            <Plus size={22} strokeWidth={2.25} /> Shto shpenzim
          </button>
        )}
      </div>

      <QuickAdd
        open={!!sheet}
        editing={sheet?.editing ?? null}
        onClose={() => setSheet(null)}
        onSaved={onSaved}
        members={members}
        accounts={accounts}
        categories={categories}
      />
    </main>
  );
}

function sum(list: Transaction[]) {
  return list.reduce((a, t) => a + t.amountCents, 0);
}
