"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Category, Transaction } from "@/lib/db";
import { formatCents, monthName } from "@/lib/money";
import { monthInfo, sum, useMonthTxs } from "@/lib/data";
import { catColor } from "@/lib/categoryStyle";
import { CatTile } from "@/components/CatTile";
import { Amount } from "@/components/Amount";
import { useShell } from "@/components/shell/MainShell";
import { Empty, MonthHeader, TxRow } from "./parts";
import s from "./ui.module.css";

type Group = { cat: Category; cents: number; subs: { name: string; cents: number }[] };

export function StatsView() {
  const { offset, lookups, openEdit } = useShell();
  const { view, lastDay } = monthInfo(offset);
  const prevView = monthInfo(offset - 1).view;
  const txs = useMonthTxs(offset);
  const prevTxs = useMonthTxs(offset - 1);
  const [open, setOpen] = useState<string | null>(null);

  const expenses = useMemo(() => txs.filter((t) => t.kind === "expense"), [txs]);
  const spent = sum(expenses);
  const earned = sum(txs.filter((t) => t.kind === "income"));
  const prevSpent = sum(prevTxs.filter((t) => t.kind === "expense"));
  const delta = prevSpent ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null;

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const t of expenses) {
      const g = lookups.topGroup(t.categoryId);
      if (!g) continue;
      const cur = map.get(g.id) ?? { cat: g, cents: 0, subs: [] };
      cur.cents += t.amountCents;
      const c = t.categoryId ? lookups.catById.get(t.categoryId) : undefined;
      const subName = c && c.parentId ? c.name : "Të tjera";
      const sub = cur.subs.find((x) => x.name === subName);
      if (sub) sub.cents += t.amountCents; else cur.subs.push({ name: subName, cents: t.amountCents });
      map.set(g.id, cur);
    }
    const list = [...map.values()].sort((a, b) => b.cents - a.cents);
    list.forEach((g) => g.subs.sort((a, b) => b.cents - a.cents));
    return list;
  }, [expenses, lookups]);

  const people = lookups.members.map((m) => ({ m, cents: sum(expenses.filter((t) => t.paidByMember === m.id)) }));
  const accounts = lookups.accounts.map((a) => ({ a, cents: sum(expenses.filter((t) => t.accountId === a.id)) }));
  const biggest = useMemo(() => [...expenses].sort((a, b) => b.amountCents - a.amountCents).slice(0, 5), [expenses]);

  // 50/50: how much one person should give the other so both paid half.
  const owe = (() => {
    if (people.length !== 2 || !spent) return null;
    const half = spent / 2;
    const [a, b] = people;
    const diff = Math.round(a.cents - half);
    if (Math.abs(diff) < 1) return { even: true as const };
    return diff > 0 ? { from: b.m, to: a.m, cents: diff } : { from: a.m, to: b.m, cents: -diff };
  })();

  const prev = monthName(prevView).toLowerCase();

  return (
    <>
      <MonthHeader title="Analiza" />

      {expenses.length === 0 ? (
        <Empty title={`Asnjë shpenzim në ${monthName(view).toLowerCase()}`} />
      ) : (
        <>
          <section className={`${s.heroBlock} rise`}>
            <Amount cents={spent} size={48} animate />
            {delta !== null && (
              <p className={s.heroSub}>
                {delta === 0 ? `Njësoj si në ${prev}` : `${Math.abs(delta)}% ${delta > 0 ? "më shumë" : "më pak"} se në ${prev}`}
              </p>
            )}
          </section>

          <div className={s.stats}>
            <div className={s.stat}><span>Në ditë</span><Amount cents={Math.round(spent / lastDay)} size={17} /></div>
            {earned > 0 && <div className={s.stat}><span>Të ardhura</span><Amount cents={earned} size={17} className={s.inc} /></div>}
            {earned > 0 && <div className={s.stat}><span>Mbetur</span><Amount cents={Math.max(earned - spent, 0)} size={17} /></div>}
          </div>

          <section className={s.section}>
            <div className={s.h2Row}><h2 className={s.h2}>Kategoritë</h2></div>
            <Donut groups={groups} total={spent} />
            <ul className={s.list}>
              {groups.map((g) => {
                const isOpen = open === g.cat.id;
                return (
                  <li key={g.cat.id}>
                    <button className={s.catRow} onClick={() => setOpen(isOpen ? null : g.cat.id)} aria-expanded={isOpen}>
                      <CatTile icon={g.cat.icon} color={g.cat.color} />
                      <span className={s.catMain}>
                        <span className={s.catLine}>
                          <span className={s.catName}>{g.cat.name}</span>
                          <Amount cents={g.cents} size={16} />
                        </span>
                        <span className={s.track}><i style={{ width: `${(g.cents / spent) * 100}%`, background: catColor(g.cat.icon, g.cat.color).fg }} /></span>
                      </span>
                      <ChevronRight size={16} strokeWidth={2} className={`${s.chev} ${isOpen ? s.chevOpen : ""}`} />
                    </button>
                    {isOpen && (
                      <ul className={s.subList}>
                        {g.subs.map((x) => <li key={x.name}><span>{x.name}</span><span className="num">{formatCents(x.cents)}</span></li>)}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={s.section}>
            <div className={s.h2Row}><h2 className={s.h2}>Kush pagoi</h2></div>
            <div className={s.splitBar}>
              {people.filter((p) => p.cents > 0).map((p) => <span key={p.m.id} data-color={p.m.color} style={{ flexGrow: p.cents }} />)}
            </div>
            <div className={s.pair}>
              {people.map((p) => (
                <div key={p.m.id} className={s.pairItem}>
                  <span className={s.pairLabel}><i className={s.key} data-color={p.m.color} />{p.m.name}</span>
                  <Amount cents={p.cents} size={17} />
                </div>
              ))}
            </div>
            {owe && (
              <p className={s.note}>
                {"even" in owe ? "Jeni barazi" : <>50/50: {owe.from.name} → {owe.to.name} <b className="num">{formatCents(owe.cents)}</b></>}
              </p>
            )}
          </section>

          <section className={s.section}>
            <div className={s.h2Row}><h2 className={s.h2}>Cash apo kartelë</h2></div>
            <div className={s.splitBar}>
              {accounts.filter((x) => x.cents > 0).map((x) => <span key={x.a.id} data-color={x.a.kind === "cash" ? "lime" : "ink"} style={{ flexGrow: x.cents }} />)}
            </div>
            <div className={s.pair}>
              {accounts.map((x) => (
                <div key={x.a.id} className={s.pairItem}>
                  <span className={s.pairLabel}><i className={s.key} data-color={x.a.kind === "cash" ? "lime" : "ink"} />{x.a.name}</span>
                  <Amount cents={x.cents} size={17} />
                </div>
              ))}
            </div>
          </section>

          <section className={s.section}>
            <div className={s.h2Row}><h2 className={s.h2}>Më të mëdhatë</h2></div>
            <ul className={s.list}>
              {biggest.map((t: Transaction) => (
                <li key={t.id}><button style={{ width: "100%" }} onClick={() => openEdit(t)}><TxRow t={t} /></button></li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}

function Donut({ groups, total }: { groups: Group[]; total: number }) {
  const r = 60;
  const C = 2 * Math.PI * r;
  const gap = groups.length > 1 ? 3 : 0;
  let acc = 0;
  return (
    <div className={s.donutWrap}>
      <svg viewBox="0 0 140 140" role="img" aria-label={groups.map((g) => `${g.cat.name} ${formatCents(g.cents)}`).join(", ")}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth="10" />
        {groups.map((g) => {
          const len = (g.cents / total) * C;
          const el = (
            <circle
              key={g.cat.id}
              className={s.seg}
              cx="70" cy="70" r={r} fill="none"
              stroke={catColor(g.cat.icon, g.cat.color).fg}
              strokeWidth="10"
              strokeDasharray={`${Math.max(len - gap, 0.01)} ${C}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 70 70)"
            />
          );
          acc += len;
          return el;
        })}
      </svg>
    </div>
  );
}
