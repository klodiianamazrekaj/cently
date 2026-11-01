"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { formatCents, monthName } from "@/lib/money";
import { groupByDay, monthInfo, sum, useMonthTxs } from "@/lib/data";
import { Amount } from "@/components/Amount";
import { useShell } from "@/components/shell/MainShell";
import { Empty, MonthNav, TxList } from "./parts";
import s from "./ui.module.css";

type Kind = "all" | "expense" | "income";

export function TransactionsView() {
  const { offset, lookups } = useShell();
  const { view, isCurrent } = monthInfo(offset);
  const txs = useMonthTxs(offset);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [who, setWho] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txs.filter((t) => {
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
  }, [txs, query, kind, who, lookups]);

  const spent = sum(filtered.filter((t) => t.kind === "expense"));
  const earned = sum(filtered.filter((t) => t.kind === "income"));
  const filtering = !!query.trim() || kind !== "all" || !!who;

  return (
    <>
      <div className={s.titleRow}>
        <h1 className={s.pageTitle}>Lëvizjet</h1>
        <MonthNav />
      </div>

      <section className={s.heroBlock}>
        <Amount cents={kind === "income" ? earned : spent} size={40} className={kind === "income" ? s.inc : ""} />
        {kind === "all" && earned > 0 && <p className={s.heroSub}><b>+{formatCents(earned)}</b> të ardhura</p>}
      </section>

      <div className={s.tools}>
        <label className={s.search}>
          <Search size={16} strokeWidth={2} />
          <input type="search" placeholder="Kërko" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Kërko" />
          {query && <button onClick={() => setQuery("")} aria-label="Pastro"><X size={15} strokeWidth={2} /></button>}
        </label>
      </div>

      <div className={s.filters} role="toolbar" aria-label="Filtrat">
        {([["all", "Të gjitha"], ["expense", "Shpenzime"], ["income", "Të ardhura"]] as const).map(([k, label]) => (
          <button key={k} className={`${s.filter} ${kind === k ? s.filterOn : ""}`} onClick={() => setKind(k)} aria-pressed={kind === k}>{label}</button>
        ))}
        <span className={s.filterSep} />
        {lookups.members.map((m) => (
          <button key={m.id} className={`${s.filter} ${who === m.id ? s.filterOn : ""}`} onClick={() => setWho(who === m.id ? null : m.id)} aria-pressed={who === m.id}>
            {m.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty title={filtering ? "Asnjë rezultat" : isCurrent ? "Asnjë shpenzim ende" : `Asnjë shpenzim në ${monthName(view).toLowerCase()}`} />
      ) : (
        <TxList groups={groupByDay(filtered)} />
      )}
    </>
  );
}
