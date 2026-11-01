"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Delete, X } from "lucide-react";
import { addTransaction, updateTransaction, type Account, type Category, type Member, type Transaction } from "@/lib/db";
import { inputToCents, onDay, pressKey, sameDay, shortDate, toDateInput } from "@/lib/money";
import { catColor } from "@/lib/categoryStyle";
import { CategoryIcon } from "./CategoryIcon";
import s from "./QuickAdd.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (occurredAt: number) => void;
  editing?: Transaction | null;
  members: Member[];
  accounts: Account[];
  categories: Category[];
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"];
const DAY = 86_400_000;

// Cents back to keypad text: 650 -> "6,5", 1240 -> "12,4", 600 -> "6"
function centsToInput(cents: number) {
  const e = Math.floor(cents / 100);
  const c = cents % 100;
  if (!c) return String(e);
  return `${e},${String(c).padStart(2, "0").replace(/0$/, "")}`;
}

export function QuickAdd({ open, onClose, onSaved, editing, members, accounts: rawAccounts, categories }: Props) {
  const accounts = useMemo(() => [...rawAccounts].sort((a, b) => a.kind.localeCompare(b.kind)), [rawAccounts]);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [input, setInput] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [payer, setPayer] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<number>(Date.now());
  const [saving, setSaving] = useState(false);
  const [bump, setBump] = useState(0);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const groups = useMemo(
    () => categories.filter((c) => !c.parentId && c.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, kind]
  );
  const subs = useMemo(
    () => (groupId ? categories.filter((c) => c.parentId === groupId).sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [categories, groupId]
  );

  // Fill the form only when the screen opens: empty for a new expense, prefilled when editing.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const c = editing.categoryId ? catById.get(editing.categoryId) : undefined;
      setKind(editing.kind);
      setInput(centsToInput(editing.amountCents));
      setGroupId(c?.parentId ?? c?.id ?? null);
      setSubId(c?.parentId ? c.id : null);
      setPayer(editing.paidByMember);
      setAccountId(editing.accountId);
      setNote(editing.note ?? "");
      setWhen(editing.occurredAt);
    } else {
      setInput("");
      setNote("");
      setSubId(null);
      setGroupId(null);
      setWhen(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  // Default payer and account once they have loaded.
  const firstMember = members[0]?.id ?? null;
  const firstAccount = accounts[0]?.id ?? null;
  useEffect(() => { setPayer((p) => p ?? firstMember); }, [firstMember]);
  useEffect(() => { setAccountId((a) => a ?? firstAccount); }, [firstAccount]);

  // Typing on a laptop keyboard works too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "," || e.key === ".") press(",");
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) return null;

  const cents = inputToCents(input);
  const canSave = cents > 0 && !!groupId && !saving;
  const [euros, decimals] = input.split(",");
  const now = Date.now();
  const isToday = sameDay(when, now);
  const isYesterday = sameDay(when, now - DAY);

  function press(k: string) {
    setInput((v) => pressKey(v, k));
    setBump((b) => b + 1);
    if (navigator.vibrate) navigator.vibrate(5);
  }

  function pickKind(k: "expense" | "income") {
    if (k === kind) return;
    setKind(k);
    setGroupId(null);
    setSubId(null);
  }

  // Keep the original time when editing; use the current time for a new expense.
  const setDay = (day: Date) => setWhen(onDay(day, editing ? new Date(editing.occurredAt) : new Date()));

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const fields = {
      kind,
      amountCents: cents,
      categoryId: subId ?? groupId,
      accountId,
      paidByMember: payer,
      note: note.trim() || null,
      occurredAt: when,
    };
    if (editing) await updateTransaction(editing.id, fields);
    else await addTransaction({ ...fields, scope: "ours" });
    setSaving(false);
    if (navigator.vibrate) navigator.vibrate(12);
    onSaved?.(when);
    onClose();
  };

  const groupColor = catColor(groups.find((g) => g.id === groupId)?.icon);
  const label = kind === "expense" ? "shpenzimin" : "të ardhurat";

  return (
    <div className={s.screen} role="dialog" aria-label={editing ? "Ndrysho shpenzimin" : "Shto shpenzim"}>
      <div className={s.top}>
        <button className={`${s.close} press`} onClick={onClose} aria-label="Mbyll"><X size={20} strokeWidth={2} /></button>
        <div className={s.segment} role="tablist">
          <button role="tab" aria-selected={kind === "expense"} className={kind === "expense" ? s.segOn : s.seg} onClick={() => pickKind("expense")}>Shpenzim</button>
          <button role="tab" aria-selected={kind === "income"} className={kind === "income" ? s.segOn : s.seg} onClick={() => pickKind("income")}>Të ardhura</button>
        </div>
        <span className={s.spacer} />
      </div>

      <div className={s.amountWrap}>
        {editing && <span className={s.editTag}>Po ndryshon</span>}
        <div key={bump} className={`${s.amount} num ${kind === "income" ? s.income : ""} ${input ? "" : s.empty}`}>
          <span>{euros || "0"}</span>
          {decimals !== undefined && <span className={s.decimals}>,{decimals}</span>}
          <span className={s.caret} />
          <span className={s.euro}>€</span>
        </div>
        <input className={s.note} placeholder="Shto një shënim" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
      </div>

      <div className={s.dates} aria-label="Data">
        <button className={`${s.date} press ${isToday ? s.dateOn : ""}`} onClick={() => setDay(new Date())} aria-pressed={isToday}>Sot</button>
        <button className={`${s.date} press ${isYesterday ? s.dateOn : ""}`} onClick={() => setDay(new Date(now - DAY))} aria-pressed={isYesterday}>Dje</button>
        <label className={`${s.date} ${s.datePick} press ${!isToday && !isYesterday ? s.dateOn : ""}`}>
          <CalendarDays size={15} strokeWidth={2} />
          {!isToday && !isYesterday ? shortDate(when) : "Tjetër ditë"}
          <input
            type="date"
            aria-label="Zgjidh datën"
            value={toDateInput(when)}
            max={toDateInput(now)}
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split("-").map(Number);
              setDay(new Date(y, m - 1, d));
            }}
          />
        </label>
      </div>

      <div className={s.grid} aria-label="Kategoria">
        {groups.map((g) => {
          const c = catColor(g.icon);
          const on = groupId === g.id;
          return (
            <button
              key={g.id}
              className={`${s.tile} press ${on ? s.tileOn : ""}`}
              style={{ ["--tile-bg" as string]: c.bg, ["--tile-fg" as string]: c.fg }}
              onClick={() => { setGroupId(on ? null : g.id); setSubId(null); }}
              aria-pressed={on}
            >
              <span className={s.tileIcon}><CategoryIcon name={g.icon} size={22} /></span>
              <span className={s.tileName}>{g.name}</span>
            </button>
          );
        })}
      </div>

      <div className={s.subs}>
        {subs.map((c) => (
          <button
            key={c.id}
            className={`${s.sub} press ${subId === c.id ? s.subOn : ""}`}
            style={{ ["--tile-bg" as string]: groupColor.bg, ["--tile-fg" as string]: groupColor.fg }}
            onClick={() => setSubId(subId === c.id ? null : c.id)}
            aria-pressed={subId === c.id}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className={s.pickers}>
        <div className={s.toggle} aria-label={kind === "expense" ? "Kush pagoi" : "Kush fitoi"}>
          {members.map((m) => (
            <button key={m.id} className={payer === m.id ? s.toggleOn : s.toggleBtn} onClick={() => setPayer(m.id)}>
              <span className={s.av} data-color={m.color}>{m.name.charAt(0)}</span>
              {m.name}
            </button>
          ))}
        </div>
        <div className={s.toggle} aria-label="Me çfarë">
          {accounts.map((a) => (
            <button key={a.id} className={accountId === a.id ? s.toggleOn : s.toggleBtn} onClick={() => setAccountId(a.id)}>{a.name}</button>
          ))}
        </div>
      </div>

      <div className={s.keypad}>
        {KEYS.map((k) => (
          <button key={k} className={`${s.key} num`} onClick={() => press(k)} aria-label={k === "del" ? "Fshi" : k}>
            {k === "del" ? <Delete size={24} strokeWidth={1.75} /> : k}
          </button>
        ))}
      </div>

      <button className={`${s.save} press`} disabled={!canSave} onClick={save}>
        {cents === 0 ? "Shkruaj shumën" : !groupId ? "Zgjidh kategorinë" : editing ? "Ruaj ndryshimet" : `Ruaj ${label}`}
      </button>
    </div>
  );
}
