"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { formatCents, monthName } from "@/lib/money";
import { groupByDay, monthInfo, sum, useMonthTxs } from "@/lib/data";
import { Amount } from "@/components/Amount";
import { useShell } from "@/components/shell/MainShell";
import { SWIPED_KEY } from "@/components/SwipeRow";
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
  const [swiped, setSwiped] = useState(true);

  // The swipe hint shows until the first swipe, then never again on this phone.
  useEffect(() => {
    const read = () => { try { setSwiped(localStorage.getItem(SWIPED_KEY) === "1"); } catch { setSwiped(false); } };
    read();
    window.addEventListener(SWIPED_KEY, read);
    return () => window.removeEventListener(SWIPED_KEY, read);
  }, []);

  const spent = sum(txs.filter((t) => t.kind === "expense"));
  const earned = sum(txs.filter((t) => t.kind === "income"));

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

  const filteredTotal = sum(filtered.filter((t) => t.kind === "expense"));
  const filtering = !!query.trim() || kind !== "all" || !!who;

  return (
    <>
      <div className={s.titleRow}>
        <h1 className={s.pageTitle}>Lëvizjet</h1>
        <MonthNav />
      </div>

      <div className={s.summary}>
        <div className={s.sumCard}><span>Shpenzime</span><Amount cents={spent} size={22} /></div>
        <div className={s.sumCard}><span>Të ardhura</span><Amount cents={earned} size={22} className={earned ? s.inc : ""} /></div>
      </div>

      <label className={s.search}>
        <Search size={18} strokeWidth={2} />
        <input type="search" placeholder="Kërko: kafe, market, Benjamin…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Kërko" />
        {query && <button onClick={() => setQuery("")} aria-label="Pastro"><X size={16} strokeWidth={2} /></button>}
      </label>

      <div className={s.chips}>
        {([["all", "Të gjitha"], ["expense", "Shpenzime"], ["income", "Të ardhura"]] as const).map(([k, label]) => (
          <button key={k} className={`${s.chip} ${kind === k ? s.chipOn : ""} press`} onClick={() => setKind(k)}>{label}</button>
        ))}
        <span className={s.chipDivider} />
        {lookups.members.map((m) => (
          <button key={m.id} className={`${s.chip} ${who === m.id ? s.chipOn : ""} press`} onClick={() => setWho(who === m.id ? null : m.id)}>
            <i className={s.dot} data-color={m.color} />{m.name}
          </button>
        ))}
      </div>

      {filtering && filtered.length > 0 && (
        <p className={s.hint}>{filtered.length} rezultate · {formatCents(filteredTotal)} shpenzime</p>
      )}
      {!filtering && !swiped && filtered.length > 0 && <p className={s.hint}>Rrëshqit majtas mbi një shpenzim për ta ndryshuar ose fshirë.</p>}

      {filtered.length === 0 ? (
        <Empty
          title={filtering ? "Asnjë rezultat" : isCurrent ? "Asnjë shpenzim ende" : `Asnjë shpenzim në ${monthName(view).toLowerCase()}`}
          text={filtering ? "Provo një fjalë tjetër ose hiq filtrat." : undefined}
        />
      ) : (
        <TxList groups={groupByDay(filtered)} />
      )}
    </>
  );
}
