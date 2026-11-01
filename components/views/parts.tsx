"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
      <button className={`${s.monthArrow} press`} onClick={() => setOffset(offset - 1)} aria-label="Muaji i kaluar"><ChevronLeft size={18} strokeWidth={2} /></button>
      <span className={s.monthLabel}>{monthName(view)}{view.getFullYear() !== now.getFullYear() ? ` ${String(view.getFullYear()).slice(2)}` : ""}</span>
      <button className={`${s.monthArrow} press`} onClick={() => setOffset(Math.min(0, offset + 1))} disabled={offset >= 0} aria-label="Muaji tjetër"><ChevronRight size={18} strokeWidth={2} /></button>
    </div>
  );
}

// A small dot: lime when synced, grey offline, red on error.
export function SyncBadge() {
  const sync = useSyncState();
  const { household } = useShell();
  if (!household) return null;
  const label = sync.phase === "offline" ? "Pa internet" : sync.phase === "error" ? "Sinkronizimi dështoi" : "Sinkronizuar";
  return <span className={s.syncBadge} data-phase={sync.phase} role="img" aria-label={label} title={label} />;
}

// Category icon, name or note, one short muted line, amount.
export function TxRow({ t }: { t: Transaction }) {
  const { lookups } = useShell();
  const c = t.categoryId ? lookups.catById.get(t.categoryId) : undefined;
  const grp = lookups.topGroup(t.categoryId);
  const m = t.paidByMember ? lookups.memberById.get(t.paidByMember) : undefined;
  return (
    <div className={s.tx}>
      <CatTile icon={grp?.icon} color={grp?.color} />
      <span className={s.txText}>
        <span className={s.txName}>{t.note || c?.name || "Pa kategori"}</span>
        <span className={s.txSub}>{[t.note ? c?.name : null, m?.name, timeLabel(t.occurredAt)].filter(Boolean).join(" · ")}</span>
      </span>
      <Amount cents={t.amountCents} size={16} sign={t.kind === "income" ? "+" : undefined} className={t.kind === "income" ? s.inc : ""} />
    </div>
  );
}

// Day-grouped list with half-swipe to edit or delete. Tapping a row opens it.
export function TxList({ groups, showDays = true }: { groups: DayGroup[]; showDays?: boolean }) {
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

  const rows = (items: Transaction[]) => (
    <ul className={s.list}>
      {items.map((t) => (
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
  );

  if (!showDays) return rows(groups.flatMap((g) => g.items));
  return (
    <>
      {groups.map((g) => (
        <div key={g.key} className={s.dayGroup}>
          <div className={s.dayHead}>
            <span>{g.label}</span>
            {g.total > 0 && <span className="num">{formatCents(g.total)}</span>}
          </div>
          {rows(g.items)}
        </div>
      ))}
    </>
  );
}

export function Empty({ title }: { title: string }) {
  return <div className={s.empty}><p>{title}</p></div>;
}
