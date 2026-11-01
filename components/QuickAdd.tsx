"use client";

import { useEffect, useMemo, useState } from "react";
import { Delete, X } from "lucide-react";
import { addTransaction, type Account, type Category, type Member } from "@/lib/db";
import { inputToCents, pressKey } from "@/lib/money";
import { catColor } from "@/lib/categoryStyle";
import { CategoryIcon } from "./CategoryIcon";
import s from "./QuickAdd.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  members: Member[];
  accounts: Account[];
  categories: Category[];
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"];

export function QuickAdd({ open, onClose, members, accounts, categories }: Props) {
  accounts = [...accounts].sort((a, b) => a.kind.localeCompare(b.kind));
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [input, setInput] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [payer, setPayer] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [bump, setBump] = useState(0);

  const groups = useMemo(
    () => categories.filter((c) => !c.parentId && c.kind === kind).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, kind]
  );
  const subs = useMemo(
    () => (groupId ? categories.filter((c) => c.parentId === groupId).sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [categories, groupId]
  );

  useEffect(() => {
    if (!open) return;
    setInput("");
    setNote("");
    setSubId(null);
    setGroupId(null);
    setPayer((p) => p ?? members[0]?.id ?? null);
    setAccountId((a) => a ?? accounts[0]?.id ?? null);
  }, [open, members, accounts]);

  useEffect(() => {
    setGroupId(null);
    setSubId(null);
  }, [kind]);

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

  function press(k: string) {
    setInput((v) => pressKey(v, k));
    setBump((b) => b + 1);
    if (navigator.vibrate) navigator.vibrate(5);
  }

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    await addTransaction({
      kind,
      amountCents: cents,
      categoryId: subId ?? groupId,
      accountId,
      paidByMember: payer,
      scope: "ours",
      note: note.trim() || null,
      occurredAt: Date.now(),
    });
    setSaving(false);
    if (navigator.vibrate) navigator.vibrate(12);
    onClose();
  };

  const groupColor = catColor(groups.find((g) => g.id === groupId)?.icon);

  return (
    <div className={s.screen} role="dialog" aria-label="Shto shpenzim">
      <div className={s.top}>
        <button className={`${s.close} press`} onClick={onClose} aria-label="Mbyll"><X size={20} strokeWidth={2} /></button>
        <div className={s.segment} role="tablist">
          <button role="tab" aria-selected={kind === "expense"} className={kind === "expense" ? s.segOn : s.seg} onClick={() => setKind("expense")}>Shpenzim</button>
          <button role="tab" aria-selected={kind === "income"} className={kind === "income" ? s.segOn : s.seg} onClick={() => setKind("income")}>Të ardhura</button>
        </div>
        <span className={s.spacer} />
      </div>

      <div className={s.amountWrap}>
        <div key={bump} className={`${s.amount} num ${kind === "income" ? s.income : ""} ${input ? "" : s.empty}`}>
          <span>{euros || "0"}</span>
          {decimals !== undefined && <span className={s.decimals}>,{decimals}</span>}
          <span className={s.caret} />
          <span className={s.euro}>€</span>
        </div>
        <input className={s.note} placeholder="Shto një shënim" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
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
        {cents === 0 ? "Shkruaj shumën" : !groupId ? "Zgjidh kategorinë" : kind === "expense" ? "Ruaj shpenzimin" : "Ruaj të ardhurat"}
      </button>
    </div>
  );
}
