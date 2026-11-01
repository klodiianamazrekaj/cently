"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, CreditCard, Delete, PencilLine, Plus, Wallet, X } from "lucide-react";
import { addTransaction, updateTransaction, type Account, type Category, type Member, type Transaction } from "@/lib/db";
import { inputToCents, onDay, pressKey, sameDay, shortDate } from "@/lib/money";
import { catColor } from "@/lib/categoryStyle";
import { CategoryIcon } from "./CategoryIcon";
import { DateSheet } from "./DateSheet";
import s from "./QuickAdd.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (occurredAt: number) => void;
  onNewCategory?: (kind: "expense" | "income", done: (id: string) => void) => void;
  editing?: Transaction | null;
  defaultPayer?: string | null;
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

export function QuickAdd({ open, onClose, onSaved, onNewCategory, editing, defaultPayer, members, accounts: rawAccounts, categories }: Props) {
  const accounts = useMemo(() => [...rawAccounts].sort((a, b) => a.kind.localeCompare(b.kind)), [rawAccounts]);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [input, setInput] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [payer, setPayer] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [when, setWhen] = useState<number>(Date.now());
  const [saving, setSaving] = useState(false);
  const [bump, setBump] = useState(0);
  const [calendar, setCalendar] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);

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
      setKind("expense");
      setInput("");
      setNote("");
      setSubId(null);
      setGroupId(null);
      setWhen(Date.now());
      setPayer(defaultPayer ?? members[0]?.id ?? null);
    }
    setNoteOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  // Default payer and account once they have loaded.
  const firstMember = defaultPayer ?? members[0]?.id ?? null;
  const firstAccount = accounts[0]?.id ?? null;
  useEffect(() => { setPayer((p) => p ?? firstMember); }, [firstMember]);
  useEffect(() => { setAccountId((a) => a ?? firstAccount); }, [firstAccount]);
  useEffect(() => { if (noteOpen) noteRef.current?.focus(); }, [noteOpen]);

  // Typing on a laptop keyboard works too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || calendar) return;
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
  const dateLabel = sameDay(when, now) ? "Sot" : sameDay(when, now - DAY) ? "Dje" : shortDate(when);
  const payerMember = members.find((m) => m.id === payer);
  const account = accounts.find((a) => a.id === accountId);

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

  const cycle = <T extends { id: string }>(list: T[], current: string | null) => {
    if (!list.length) return null;
    const i = list.findIndex((x) => x.id === current);
    return list[(i + 1) % list.length].id;
  };

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

  const group = groups.find((g) => g.id === groupId);
  const groupColor = catColor(group?.icon, group?.color);
  const label = kind === "expense" ? "shpenzimin" : "të ardhurat";

  return (
    <div className={s.screen} role="dialog" aria-label={editing ? "Ndrysho" : "Shto shpenzim"}>
      <div className={s.top}>
        <button className={`${s.close} press`} onClick={onClose} aria-label="Mbyll"><X size={22} strokeWidth={1.75} /></button>
        <div className={s.segment} role="tablist" aria-label="Lloji">
          <button role="tab" aria-selected={kind === "expense"} className={kind === "expense" ? s.segOn : s.seg} onClick={() => pickKind("expense")}>Shpenzim</button>
          <button role="tab" aria-selected={kind === "income"} className={kind === "income" ? s.segOn : s.seg} onClick={() => pickKind("income")}>Të ardhura</button>
        </div>
        <span className={s.spacer} />
      </div>

      <div className={s.amountWrap}>
        {editing && <span className={s.editTag}>Po ndryshon</span>}
        <div key={bump} className={`${s.amount} num ${kind === "income" ? s.income : ""} ${input ? "" : s.empty}`} aria-live="polite">
          <span>{euros || "0"}</span>
          {decimals !== undefined && <span className={s.decimals}>,{decimals}</span>}
          <span className={s.caret} />
          <span className={s.euro}>€</span>
        </div>
        {(noteOpen || note) && (
          <input
            ref={noteRef}
            className={s.note}
            placeholder="Shënim"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => setNoteOpen(false)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            maxLength={80}
            aria-label="Shënim"
          />
        )}
      </div>

      <div className={s.cats} role="group" aria-label="Kategoria">
        {groups.map((g) => {
          const c = catColor(g.icon, g.color);
          const on = groupId === g.id;
          return (
            <button
              key={g.id}
              className={`${s.cat} ${on ? s.catOn : ""}`}
              style={{ ["--tile-bg" as string]: c.bg, ["--tile-fg" as string]: c.fg }}
              onClick={() => { setGroupId(on ? null : g.id); setSubId(null); }}
              aria-pressed={on}
            >
              <span className={s.catIcon}><CategoryIcon name={g.icon} size={22} /></span>
              <span className={s.catName}>{g.name}</span>
            </button>
          );
        })}
        {onNewCategory && (
          <button
            className={s.cat}
            onClick={() => onNewCategory(kind, (id) => { setGroupId(id); setSubId(null); })}
            aria-label="Kategori e re"
          >
            <span className={`${s.catIcon} ${s.catAdd}`}><Plus size={22} strokeWidth={1.75} /></span>
            <span className={s.catName}>E re</span>
          </button>
        )}
      </div>

      <div className={s.subs} style={{ ["--tile-fg" as string]: groupColor.fg }}>
        {subs.map((c) => (
          <button key={c.id} className={`${s.sub} ${subId === c.id ? s.subOn : ""}`} onClick={() => setSubId(subId === c.id ? null : c.id)} aria-pressed={subId === c.id}>
            {c.name}
          </button>
        ))}
      </div>

      <div className={s.controls}>
        <button className={s.ctrl} onClick={() => setCalendar(true)} aria-label={`Data: ${dateLabel}`}>
          <CalendarDays size={15} strokeWidth={1.75} />{dateLabel}
        </button>
        {payerMember && (
          <button className={s.ctrl} onClick={() => setPayer(cycle(members, payer))} aria-label={`${kind === "expense" ? "Pagoi" : "Fitoi"}: ${payerMember.name}`}>
            <span className={s.av} data-color={payerMember.color}>{payerMember.name.charAt(0)}</span>{payerMember.name}
          </button>
        )}
        {account && (
          <button className={s.ctrl} onClick={() => setAccountId(cycle(accounts, accountId))} aria-label={`Me: ${account.name}`}>
            {account.kind === "cash" ? <Wallet size={15} strokeWidth={1.75} /> : <CreditCard size={15} strokeWidth={1.75} />}{account.name}
          </button>
        )}
        <button className={`${s.ctrl} ${note ? s.ctrlOn : ""}`} onClick={() => setNoteOpen(true)} aria-label="Shënim">
          {note ? <Check size={15} strokeWidth={2} /> : <PencilLine size={15} strokeWidth={1.75} />}Shënim
        </button>
      </div>

      <div className={s.keypad}>
        {KEYS.map((k) => (
          <button key={k} className={`${s.key} num`} onClick={() => press(k)} aria-label={k === "del" ? "Fshi" : k}>
            {k === "del" ? <Delete size={24} strokeWidth={1.5} /> : k}
          </button>
        ))}
      </div>

      <button className={`${s.save} press`} disabled={!canSave} onClick={save} data-save>
        {cents === 0 ? "Shkruaj shumën" : !groupId ? "Zgjidh kategorinë" : editing ? "Ruaj ndryshimet" : `Ruaj ${label}`}
      </button>

      <DateSheet open={calendar} value={new Date(when)} onSelect={setDay} onClose={() => setCalendar(false)} quick />
    </div>
  );
}
