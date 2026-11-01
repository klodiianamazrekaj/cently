// Albanian money format: 1.284,50 €
const fmt = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCents(cents: number, opts: { sign?: boolean } = {}) {
  const s = `${fmt.format(Math.abs(cents) / 100)} €`;
  if (!opts.sign) return s;
  return cents >= 0 ? `+${s}` : `−${s}`;
}

// Keypad input is kept as a digit string of cents: "150" means 1,50 €.
export function digitsToCents(digits: string) {
  return digits ? parseInt(digits, 10) : 0;
}

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { start, end };
}

const MONTHS = ["Janari", "Shkurti", "Marsi", "Prilli", "Maji", "Qershori", "Korriku", "Gushti", "Shtatori", "Tetori", "Nëntori", "Dhjetori"];
export const monthName = (d = new Date()) => MONTHS[d.getMonth()];

export function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Sot";
  if (same(d, y)) return "Dje";
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export const timeLabel = (ts: number) =>
  new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
