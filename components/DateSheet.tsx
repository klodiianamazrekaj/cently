"use client";

import { DayPicker } from "react-day-picker";
import { sq } from "react-day-picker/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import s from "./DateSheet.module.css";

type Props = {
  open: boolean;
  value: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
  quick?: boolean; // show a "Dje" shortcut next to "Sot"
};

// Bottom sheet with a month calendar in Cently's style. Future days are disabled.
export function DateSheet({ open, value, onSelect, onClose, quick = false }: Props) {
  if (!open) return null;
  const today = new Date();
  return (
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.sheet} role="dialog" aria-label="Zgjidh datën" onClick={(e) => e.stopPropagation()}>
        <span className={s.grabber} />
        <DayPicker
          mode="single"
          locale={sq}
          weekStartsOn={1}
          selected={value}
          defaultMonth={value}
          disabled={{ after: today }}
          endMonth={today}
          onSelect={(d) => { if (d) { onSelect(d); onClose(); } }}
          showOutsideDays
          classNames={{
            root: s.root,
            months: s.months,
            month: s.month,
            month_caption: s.caption,
            caption_label: s.captionLabel,
            nav: s.nav,
            button_previous: s.navBtn,
            button_next: s.navBtn,
            month_grid: s.grid,
            weekdays: s.weekdays,
            weekday: s.weekday,
            week: s.week,
            day: s.day,
            day_button: s.dayBtn,
            selected: s.selected,
            today: s.today,
            outside: s.outside,
            disabled: s.disabled,
          }}
          components={{
            Chevron: ({ orientation }) =>
              orientation === "left" ? <ChevronLeft size={20} strokeWidth={2} /> : <ChevronRight size={20} strokeWidth={2} />,
          }}
        />
        <div className={s.footer}>
          {quick && <button className={`${s.todayBtn} press`} onClick={() => { onSelect(new Date(Date.now() - 86_400_000)); onClose(); }}>Dje</button>}
          <button className={`${s.todayBtn} press`} onClick={() => { onSelect(new Date()); onClose(); }}>Sot</button>
          <button className={`${s.done} press`} onClick={onClose}>Mbyll</button>
        </div>
      </div>
    </div>
  );
}
