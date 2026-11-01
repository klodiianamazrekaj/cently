"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight } from "lucide-react";
import { db, type Category } from "@/lib/db";
import { formatCents, monthName } from "@/lib/money";
import { groupByDay, monthInfo, sum, useMonthTxs } from "@/lib/data";
import { CatTile } from "@/components/CatTile";
import { Amount } from "@/components/Amount";
import { useShell } from "@/components/shell/MainShell";
import { Empty, SyncBadge, TxList } from "./parts";
import s from "./ui.module.css";

export function HomeView() {
  const { lookups, setTab, setOffset } = useShell();
  const { members, topGroup } = lookups;
  const { view, daysInMonth, lastDay } = monthInfo(0);
  const txs = useMonthTxs(0);
  const [day, setDay] = useState<number | null>(null);

  const recent = useLiveQuery(
    () => db.transactions.orderBy("occurredAt").reverse().filter((t) => !t.deletedAt).limit(5).toArray(),
    []
  ) ?? [];

  const expenses = useMemo(() => txs.filter((t) => t.kind === "expense"), [txs]);
  const spent = sum(expenses);
  const earned = sum(txs.filter((t) => t.kind === "income"));

  const perDay = useMemo(() => {
    const arr = new Array(daysInMonth).fill(0);
    for (const t of expenses) arr[new Date(t.occurredAt).getDate() - 1] += t.amountCents;
    return arr;
  }, [expenses, daysInMonth]);
  const maxDay = Math.max(...perDay, 1);

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
  }, [expenses, topGroup]);

  const people = members.map((m) => ({ m, cents: sum(expenses.filter((t) => t.paidByMember === m.id)) }));
  const month = monthName(view).toLowerCase();

  return (
    <>
      <header className={s.pageTop}>
        <p className={s.eyebrow}>{monthName(view)}</p>
        <button className={`${s.couple} press`} onClick={() => setTab("profile")} aria-label="Profili">
          <SyncBadge />
          <span className={s.avatars}>
            {members.map((m) => <span key={m.id} className={s.avatar} data-color={m.color}>{m.name.charAt(0)}</span>)}
          </span>
        </button>
      </header>

      <section className={`${s.heroBlock} rise`} style={{ marginTop: "var(--space-4)" }}>
        <Amount cents={day ? perDay[day - 1] : spent} size={56} animate />
        <p className={s.heroSub}>
          {day
            ? `${day} ${month}`
            : <>Sot {formatCents(perDay[lastDay - 1])}{earned > 0 && <> · <b>+{formatCents(earned)}</b></>}</>}
        </p>
        <div className={s.chart} role="group" aria-label="Shpenzimet sipas ditëve">
          {perDay.map((c, i) => {
            const d = i + 1;
            const future = d > lastDay;
            const selected = day === d || (!day && d === lastDay);
            return (
              <button key={d} className={s.barSlot} onClick={() => !future && setDay(day === d ? null : d)} disabled={future} aria-label={`${d} ${month}: ${formatCents(c)}`} aria-pressed={day === d}>
                <span
                  className={`${s.bar} ${selected ? s.barOn : ""} ${future ? s.barFuture : ""}`}
                  style={{ height: future ? 3 : Math.max(3, (c / maxDay) * 60), animationDelay: `${i * 10}ms` }}
                />
              </button>
            );
          })}
        </div>
        <div className={s.chartAxis}>{[1, 8, 15, 22, daysInMonth].map((d) => <span key={d} className="num">{d}</span>)}</div>
      </section>

      {people.length > 0 && (
        <section className={`${s.section} rise`} style={{ animationDelay: "60ms", marginTop: "var(--space-6)" }}>
          <div className={s.splitBar}>
            {spent > 0
              ? people.filter((p) => p.cents > 0).map((p) => <span key={p.m.id} data-color={p.m.color} style={{ flexGrow: p.cents }} />)
              : <span className={s.empty} />}
          </div>
          <div className={s.pair}>
            {people.map((p) => (
              <div key={p.m.id} className={s.pairItem}>
                <span className={s.pairLabel}><i className={s.key} data-color={p.m.color} />{p.m.name}</span>
                <Amount cents={p.cents} size={20} animate />
              </div>
            ))}
          </div>
        </section>
      )}

      {byGroup.length > 0 && (
        <section className={`${s.section} rise`} style={{ animationDelay: "100ms" }}>
          <div className={s.h2Row}>
            <h2 className={s.h2}>Kategoritë</h2>
            <button className={s.more} onClick={() => { setOffset(0); setTab("stats"); }}>Analiza <ChevronRight size={16} strokeWidth={2} /></button>
          </div>
          <ul className={s.list}>
            {byGroup.slice(0, 4).map(({ cat, cents }) => (
              <li key={cat.id} className={s.catRow}>
                <CatTile icon={cat.icon} color={cat.color} />
                <span className={`${s.catName} ${s.grow}`}>{cat.name}</span>
                <Amount cents={cents} size={16} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${s.section} rise`} style={{ animationDelay: "140ms" }}>
        <div className={s.h2Row}>
          <h2 className={s.h2}>Të fundit</h2>
          {recent.length > 0 && <button className={s.more} onClick={() => { setOffset(0); setTab("tx"); }}>Të gjitha <ChevronRight size={16} strokeWidth={2} /></button>}
        </div>
        {recent.length === 0 ? <Empty title="Asnjë shpenzim ende" /> : <TxList groups={groupByDay(recent)} showDays={false} />}
      </section>
    </>
  );
}
