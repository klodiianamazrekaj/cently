"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Transaction } from "@/lib/db";
import { formatCents, monthName, timeLabel } from "@/lib/money";
import { monthInfo, type DayGroup } from "@/lib/data";
import { useSyncState } from "@/lib/sync";
import { CatTile } from "@/components/CatTile";
import { Amount } from "@/components/Amount";
import { SwipeRow } from "@/components/SwipeRow";
import { DateSheet } from "@/components/DateSheet";
import { useShell } from "@/components/shell/MainShell";
import s from "./ui.module.css";

// Page title with the month switcher. Swipe left or right on it to change the month;
// tap the month name to jump to any date with the calendar.
export function MonthHeader({ title, onPickDate }: { title: string; onPickDate?: (d: Date) => void }) {
  const { offset, setOffset } = useShell();
  const { view, now } = monthInfo(offset);
  const [calendar, setCalendar] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const go = (n: number) => setOffset(Math.min(0, n));
  const pick = (d: Date) => {
    setOffset((d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
    onPickDate?.(d);
  };

  return (
    <div
      className={s.titleRow}
      onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => {
        const st = swipe.current;
        swipe.current = null;
        if (!st) return;
        const dx = e.clientX - st.x;
        const dy = e.clientY - st.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? offset + 1 : offset - 1);
      }}
      onPointerCancel={() => { swipe.current = null; }}
      style={{ touchAction: "pan-y" }}
    >
      <h1 className={s.pageTitle}>{title}</h1>
      <div className={s.monthNav}>
        <button className={`${s.monthArrow} press`} onClick={() => go(offset - 1)} aria-label="Muaji i kaluar"><ChevronLeft size={18} strokeWidth={2} /></button>
        <button className={s.monthLabel} onClick={() => setCalendar(true)} aria-label={`${monthName(view)}, zgjidh datën`}>
          {monthName(view)}{view.getFullYear() !== now.getFullYear() ? ` ${String(view.getFullYear()).slice(2)}` : ""}
        </button>
        <button className={`${s.monthArrow} press`} onClick={() => go(offset + 1)} disabled={offset >= 0} aria-label="Muaji tjetër"><ChevronRight size={18} strokeWidth={2} /></button>
      </div>
      <DateSheet open={calendar} value={view} onSelect={pick} onClose={() => setCalendar(false)} />
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
