// Albanian money format: 1.284,50 €
const fmt = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCents(cents: number, opts: { sign?: boolean } = {}) {
  const s = `${fmt.format(Math.abs(cents) / 100)} €`;
  if (!opts.sign) return s;
  return cents >= 0 ? `+${s}` : `−${s}`;
}

// Keypad input is typed like on a calculator: "6" is 6 €, "6,5" is 6,50 €, "12,40" is 12,40 €.
export function inputToCents(input: string) {
  if (!input) return 0;
  const [euros, cents = ""] = input.split(",");
  return (parseInt(euros || "0", 10) * 100) + parseInt((cents + "00").slice(0, 2), 10);
}

// Applies one keypad press to the current input, keeping it valid.
export function pressKey(input: string, key: string) {
  if (key === "del") return input.slice(0, -1);
  if (key === ",") {
    if (input.includes(",")) return input;
    return (input || "0") + ",";
  }
  const [euros, cents] = input.split(",");
  if (cents !== undefined) return cents.length >= 2 ? input : input + key;
  if (euros === "0") return key;
  if (euros.length >= 6) return input;
  return input + key;
}

// Splits an amount for display with smaller cents: { main: "1.284", cents: ",50" }
export function splitCents(cents: number) {
  const full = fmt.format(Math.abs(cents) / 100);
  const i = full.lastIndexOf(",");
  return { main: full.slice(0, i), cents: full.slice(i) };
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
