"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import s from "./SwipeRow.module.css";

const ACTIONS_W = 152; // two buttons of 76px
export const SWIPED_KEY = "cently.swiped";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTap?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
};

// A list row you half-swipe to the left to reveal Edit and Delete, like iPhone Mail.
export function SwipeRow({ open, onOpenChange, onTap, onEdit, onDelete, children }: Props) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Actions stay hidden at rest so their colour never shows at the rounded corners.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { if (x < 0) setRevealed(true); }, [x]);
  const g = useRef<{ startX: number; startY: number; base: number; axis: "x" | "y" | null; moved: boolean } | null>(null);

  // Follow the open state when it changes from outside (another row opened, tap elsewhere).
  useEffect(() => { if (!dragging) setX(open ? -ACTIONS_W : 0); }, [open, dragging]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    g.current = { startX: e.clientX, startY: e.clientY, base: open ? -ACTIONS_W : 0, axis: null, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = g.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      st.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (st.axis === "x") {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (st.axis !== "x") return;
    st.moved = true;
    let next = st.base + dx;
    // Rubber band past the edges.
    if (next > 0) next = next * 0.2;
    if (next < -ACTIONS_W) next = -ACTIONS_W + (next + ACTIONS_W) * 0.25;
    setX(next);
  };

  const onPointerUp = () => {
    const st = g.current;
    g.current = null;
    if (!st) return;
    if (st.axis === "x") {
      setDragging(false);
      const shouldOpen = x < -ACTIONS_W / 2.5;
      setX(shouldOpen ? -ACTIONS_W : 0);
      onOpenChange(shouldOpen);
      if (shouldOpen && navigator.vibrate) navigator.vibrate(8);
      if (shouldOpen) {
        try { localStorage.setItem(SWIPED_KEY, "1"); } catch {}
        window.dispatchEvent(new Event(SWIPED_KEY));
      }
      return;
    }
    if (st.axis === null) {
      // A plain tap: close if open, otherwise act on the row.
      if (open) onOpenChange(false);
      else onTap?.();
    }
  };

  return (
    <div className={s.wrap}>
      <div className={s.actions} aria-hidden={!open} style={{ visibility: revealed ? "visible" : "hidden" }}>
        <button className={s.edit} onClick={() => { onOpenChange(false); onEdit(); }} tabIndex={open ? 0 : -1}>
          <Pencil size={18} strokeWidth={2} />
          <span>Ndrysho</span>
        </button>
        <button className={s.del} onClick={() => { onOpenChange(false); onDelete(); }} tabIndex={open ? 0 : -1}>
          <Trash2 size={18} strokeWidth={2} />
          <span>Fshi</span>
        </button>
      </div>
      <div
        className={`${s.content} ${dragging ? s.dragging : ""}`}
        style={{ transform: `translate3d(${x}px,0,0)` }}
        onTransitionEnd={(e) => { if (e.target === e.currentTarget && x === 0 && !dragging) setRevealed(false); }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { g.current = null; setDragging(false); setX(open ? -ACTIONS_W : 0); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onTap?.(); }}
      >
        {children}
      </div>
    </div>
  );
}
