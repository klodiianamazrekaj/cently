"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { formatCents, monthName, sameDay } from "@/lib/money";
import { groupByDay, monthInfo, sum, useMonthTxs } from "@/lib/data";
import { Amount } from "@/components/Amount";
import { useShell } from "@/components/shell/MainShell";
import { Empty, MonthHeader, TxList } from "./parts";
import s from "./ui.module.css";

type Kind = "all" | "expense" | "income";
const WEEKDAYS = ["Di", "Hë", "Ma", "Më", "En", "Pr", "Sh"];

export function TransactionsView() {
  const { offset, lookups } = useShell();
  const { view, isCurrent, start, end, daysInMonth, lastDay, now } = monthInfo(offset);
  const txs = useMonthTxs(offset);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [kind, setKind] = useState<Kind>("all");
  const [who, setWho] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null); // start of a chosen day
  const strip = useRef<HTMLDivElement>(null);

  // The chosen day only counts while its month is on screen.
  const day = picked !== null && picked >= start && picked < end ? new Date(picked).getDate() : null;
  const dayStart = (d: number) => new Date(view.getFullYear(), view.getMonth(), d).getTime();
  const daysWithTx = useMemo(() => new Set(txs.map((t) => new Date(t.occurredAt).getDate())), [txs]);

  // Keep today (or the chosen day) in view in the strip.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-day="${day ?? (isCurrent ? now.getDate() : 1)}"]`);
    if (el && strip.current) strip.current.scrollLeft = el.offsetLeft - strip.current.clientWidth / 2 + el.clientWidth / 2;
  }, [day, offset, isCurrent, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txs.filter((t) => {
      if (day !== null && picked !== null && !sameDay(t.occurredAt, picked)) return false;
      if (kind !== "all" && t.kind !== kind) return false;
      if (who && t.paidByMember !== who) return false;
      if (!q) return true;
      const c = t.categoryId ? lookups.catById.get(t.categoryId) : undefined;
      const g = lookups.topGroup(t.categoryId);
      const m = t.paidByMember ? lookups.memberById.get(t.paidByMember) : undefined;
      const a = t.accountId ? lookups.accountById.get(t.accountId) : undefined;
      const hay = [t.note, c?.name, g?.name, m?.name, a?.name, formatCents(t.amountCents)].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [txs, query, kind, who, lookups, day, picked]);

  const spent = sum(filtered.filter((t) => t.kind === "expense"));
  const earned = sum(filtered.filter((t) => t.kind === "income"));
  const filtering = !!query.trim() || kind !== "all" || !!who || day !== null;
  const month = monthName(view).toLowerCase();

  const clearAll = () => { setKind("all"); setWho(null); setPicked(null); };
  const closeSearch = () => { setQuery(""); setSearching(false); };

  return (
    <>
      <MonthHeader title="Lëvizjet" onPickDate={(d) => setPicked(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())} />

      <div className={s.strip} ref={strip} role="group" aria-label="Ditët e muajit">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const future = isCurrent && d > lastDay;
          const on = day === d;
          const wk = WEEKDAYS[new Date(view.getFullYear(), view.getMonth(), d).getDay()];
          return (
            <button
              key={d}
              data-day={d}
              className={`${s.day} ${on ? s.dayOn : ""} ${daysWithTx.has(d) ? s.dayHas : ""} ${isCurrent && d === now.getDate() ? s.dayToday : ""}`}
              onClick={() => setPicked(on ? null : dayStart(d))}
              disabled={future}
              aria-pressed={on}
              aria-label={`${d} ${month}${daysWithTx.has(d) ? ", ka shpenzime" : ""}`}
            >
              <span className={s.dayWk}>{wk}</span>
              <span className={s.dayNum}>{d}</span>
              <span className={s.dayDot} />
            </button>
          );
        })}
      </div>

      <section className={s.heroBlock} style={{ marginTop: "var(--space-5)" }}>
        <Amount cents={kind === "income" ? earned : spent} size={40} className={kind === "income" ? s.inc : ""} />
        {(day !== null || (kind === "all" && earned > 0)) && (
          <p className={s.heroSub}>
            {day !== null && `${day} ${month}`}
            {day !== null && kind === "all" && earned > 0 && " · "}
            {kind === "all" && earned > 0 && <><b>+{formatCents(earned)}</b> të ardhura</>}
          </p>
        )}
      </section>

      <div className={s.tools}>
        {searching ? (
          <label className={s.search}>
            <Search size={16} strokeWidth={2} />
            <input type="search" placeholder="Kërko" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Kërko" autoFocus />
            <button onClick={closeSearch} aria-label="Mbyll kërkimin"><X size={15} strokeWidth={2} /></button>
          </label>
        ) : (
          <>
            <div className={s.filters} role="toolbar" aria-label="Filtrat">
              <button className={`${s.filter} ${!filtering ? s.filterOn : ""}`} onClick={clearAll} aria-pressed={!filtering}>Të gjitha</button>
              {([["expense", "Shpenzime"], ["income", "Të ardhura"]] as const).map(([k, label]) => (
                <button key={k} className={`${s.filter} ${kind === k ? s.filterOn : ""}`} onClick={() => setKind(kind === k ? "all" : k)} aria-pressed={kind === k}>{label}</button>
              ))}
              <span className={s.filterSep} />
              {lookups.members.map((m) => (
                <button key={m.id} className={`${s.filter} ${who === m.id ? s.filterOn : ""}`} onClick={() => setWho(who === m.id ? null : m.id)} aria-pressed={who === m.id}>
                  {m.name}
                </button>
              ))}
            </div>
            <button className={s.searchBtn} onClick={() => setSearching(true)} aria-label="Kërko"><Search size={18} strokeWidth={1.75} /></button>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <Empty title={filtering ? "Asnjë rezultat" : isCurrent ? "Asnjë shpenzim ende" : `Asnjë shpenzim në ${month}`} />
      ) : (
        <TxList groups={groupByDay(filtered)} />
      )}
    </>
  );
}
