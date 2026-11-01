"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Cloud, CloudOff } from "lucide-react";
import type { Transaction } from "@/lib/db";
import { formatCents, monthName, timeLabel } from "@/lib/money";
import { monthInfo, type DayGroup } from "@/lib/data";
import { useSyncState } from "@/lib/sync";
import { CatTile } from "@/components/CatTile";
import { Amount } from "@/components/Amount";
import { SwipeRow } from "@/components/SwipeRow";
import { useShell } from "@/components/shell/MainShell";
import s from "./ui.module.css";

export function MonthNav() {
  const { offset, setOffset } = useShell();
  const { view, now } = monthInfo(offset);
  return (
    <div className={s.monthNav}>
      <button className="press" onClick={() => setOffset(offset - 1)} aria-label="Muaji i kaluar"><ChevronLeft size={18} strokeWidth={2} /></button>
      <span className={s.monthLabel}>{monthName(view)}{view.getFullYear() !== now.getFullYear() ? ` ${String(view.getFullYear()).slice(2)}` : ""}</span>
      <button className="press" onClick={() => setOffset(Math.min(0, offset + 1))} disabled={offset >= 0} aria-label="Muaji tjetër"><ChevronRight size={18} strokeWidth={2} /></button>
    </div>
  );
}

export function SyncBadge() {
  const sync = useSyncState();
  const { household } = useShell();
  if (!household) return null;
  return (
    <span className={s.syncBadge} data-phase={sync.phase} aria-label={sync.phase === "offline" ? "Pa internet" : "Sinkronizimi"}>
      {sync.phase === "offline" || sync.phase === "error" ? <CloudOff size={13} strokeWidth={2.25} /> : <Cloud size={13} strokeWidth={2.25} />}
    </span>
  );
}

export function TxRow({ t }: { t: Transaction }) {
  const { lookups } = useShell();
  const c = t.categoryId ? lookups.catById.get(t.categoryId) : undefined;
  const grp = lookups.topGroup(t.categoryId);
  const m = t.paidByMember ? lookups.memberById.get(t.paidByMember) : undefined;
  const acc = t.accountId ? lookups.accountById.get(t.accountId) : undefined;
  return (
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
  );
}

// Day-grouped list with half-swipe to edit or delete.
export function TxList({ groups, showDayTotals = true }: { groups: DayGroup[]; showDayTotals?: boolean }) {
  const { openEdit, remove } = useShell();
  const [openRow, setOpenRow] = useState<string | null>(null);

  // Tapping anywhere outside the open row closes it.
  useEffect(() => {
    if (!openRow) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-row="${openRow}"]`)) setOpenRow(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openRow]);

  return (
    <>
      {groups.map((g) => (
        <div key={g.key} className={s.dayGroup}>
          <div className={s.dayHead}>
            <span>{g.label}</span>
            {showDayTotals && g.total > 0 && <span className="num">{formatCents(g.total)}</span>}
          </div>
          <ul className={s.card}>
            {g.items.map((t) => (
              <li key={t.id} data-row={t.id}>
                <SwipeRow
                  open={openRow === t.id}
                  onOpenChange={(o) => setOpenRow(o ? t.id : null)}
                  onTap={() => openEdit(t)}
                  onEdit={() => openEdit(t)}
                  onDelete={() => remove(t.id)}
                >
                  <TxRow t={t} />
                </SwipeRow>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className={s.empty}>
      <CatTile icon="wallet" size={56} />
      <p className={s.emptyTitle}>{title}</p>
      {text && <p>{text}</p>}
    </div>
  );
}
