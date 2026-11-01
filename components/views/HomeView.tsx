"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight } from "lucide-react";
import { db, type Category } from "@/lib/db";
import { formatCents, monthName } from "@/lib/money";
import { greeting, groupByDay, monthInfo, sum, useMonthTxs } from "@/lib/data";
import { displayName } from "@/lib/auth";
import { catColor } from "@/lib/categoryStyle";
import { CatTile } from "@/components/CatTile";
import { Amount } from "@/components/Amount";
import { useShell } from "@/components/shell/MainShell";
import { Empty, SyncBadge, TxList } from "./parts";
import s from "./ui.module.css";

export function HomeView() {
  const { lookups, household, session, setTab, setOffset } = useShell();
  const { members, memberById, topGroup } = lookups;
  const { now, view, daysInMonth, lastDay } = monthInfo(0);
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
  const activeDays = perDay.filter((c) => c > 0).length;
  const compact = activeDays < 3;
  const barMax = compact ? 40 : 80;

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
  }, [expenses, topGroup]);

  const me = household ? memberById.get(household.memberId) : undefined;
  const firstName = me?.name ?? displayName(session);

  const heroSub = day
    ? `${day} ${monthName(view).toLowerCase()}: ${formatCents(perDay[day - 1])}`
    : `Sot ${formatCents(perDay[lastDay - 1])} · mesatarisht ${formatCents(Math.round(spent / lastDay))} në ditë`;

  return (
    <>
      <header className={s.pageTop}>
        <div>
          <p className={s.greet}>{greeting(now)}{firstName ? `, ${firstName}` : ""}</p>
        </div>
        <button className={`${s.couple} press`} onClick={() => setTab("profile")} aria-label="Profili">
          <SyncBadge />
          <span className={s.avatars}>
            {members.map((m) => <span key={m.id} className={s.avatar} data-color={m.color}>{m.name.charAt(0)}</span>)}
          </span>
        </button>
      </header>
      <h1 className={s.pageTitle}>{monthName(view)}</h1>

      <section className={`${s.hero} rise`}>
        <p className={s.heroLabel}>Shpenzuar këtë muaj</p>
        <Amount cents={spent} size={52} animate />
        <p className={s.heroSub}>{heroSub}</p>
        {earned > 0 && !day && (
          <p className={s.heroIncome}>
            <Amount cents={earned} size={14} sign="+" /> të ardhura · {formatCents(Math.max(earned - spent, 0))} mbetur
          </p>
        )}
        <div className={`${s.chart} ${compact ? s.chartCompact : ""}`} role="group" aria-label="Shpenzimet sipas ditëve">
          {perDay.map((c, i) => {
            const d = i + 1;
            const future = d > lastDay;
            const selected = day === d || (!day && d === lastDay);
            return (
              <button key={d} className={s.barSlot} onClick={() => !future && setDay(day === d ? null : d)} disabled={future} aria-label={`${d}: ${formatCents(c)}`}>
                <span
                  className={`${s.bar} ${selected ? s.barOn : ""} ${future ? s.barFuture : ""}`}
                  style={{ height: future ? 4 : Math.max(4, (c / maxDay) * barMax), animationDelay: `${i * 12}ms` }}
                />
              </button>
            );
          })}
        </div>
        <div className={s.chartAxis}>{[1, 8, 15, 22, daysInMonth].map((d) => <span key={d} className="num">{d}</span>)}</div>
        {compact && (
          <p className={s.heroHint}>{activeDays === 0 ? "Shtoni shpenzimin e parë sot." : "Grafiku mbushet me çdo ditë që shtoni."}</p>
        )}
      </section>

      <section className={`${s.people} rise`} style={{ animationDelay: "60ms" }}>
        {members.map((m) => {
          const cents = sum(expenses.filter((t) => t.paidByMember === m.id));
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
        <section className={`${s.section} rise`} style={{ animationDelay: "100ms" }}>
          <div className={s.h2Row}>
            <h2 className={s.h2}>Ku shkuan paret</h2>
            <button className={s.more} onClick={() => { setOffset(0); setTab("stats"); }}>Analiza <ChevronRight size={16} strokeWidth={2} /></button>
          </div>
          <ul className={s.card}>
            {byGroup.slice(0, 4).map(({ cat, cents, count }) => (
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

      <section className={`${s.section} rise`} style={{ animationDelay: "140ms" }}>
        <div className={s.h2Row}>
          <h2 className={s.h2}>Të fundit</h2>
          {recent.length > 0 && <button className={s.more} onClick={() => { setOffset(0); setTab("tx"); }}>Të gjitha <ChevronRight size={16} strokeWidth={2} /></button>}
        </div>
        {recent.length === 0 ? (
          <Empty title="Asnjë shpenzim ende" text="Shtyp butonin + poshtë dhe shto kafen e parë." />
        ) : (
          <TxList groups={groupByDay(recent)} showDayTotals={false} />
        )}
      </section>
    </>
  );
}
