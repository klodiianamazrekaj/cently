"use client";

import { useEffect, useMemo, useState } from "react";
import { Delete, X } from "lucide-react";
import { addTransaction, type Account, type Category, type Member } from "@/lib/db";
import { digitsToCents, formatCents } from "@/lib/money";
import { CategoryIcon } from "./CategoryIcon";
import s from "./QuickAdd.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  members: Member[];
  accounts: Account[];
  categories: Category[];
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];

export function QuickAdd({ open, onClose, members, accounts, categories }: Props) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [digits, setDigits] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [payer, setPayer] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

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
    setDigits("");
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

  if (!open) return null;

  const cents = digitsToCents(digits);
  const canSave = cents > 0 && !!groupId && !saving;

  const press = (k: string) => {
    if (k === "del") return setDigits((d) => d.slice(0, -1));
    setDigits((d) => (d + k).replace(/^0+/, "").slice(0, 8));
  };

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
    if (navigator.vibrate) navigator.vibrate(10);
    onClose();
  };

  return (
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.sheet} role="dialog" aria-label="Shto shpenzim" onClick={(e) => e.stopPropagation()}>
        <div className={s.top}>
          <div className={s.segment} role="tablist">
            <button role="tab" aria-selected={kind === "expense"} className={kind === "expense" ? s.segOn : s.seg} onClick={() => setKind("expense")}>Shpenzim</button>
            <button role="tab" aria-selected={kind === "income"} className={kind === "income" ? s.segOn : s.seg} onClick={() => setKind("income")}>Të ardhura</button>
          </div>
          <button className={s.close} onClick={onClose} aria-label="Mbyll"><X size={20} strokeWidth={1.75} /></button>
        </div>

        <div className={`${s.amount} num ${kind === "income" ? s.income : ""} ${cents === 0 ? s.empty : ""}`}>
          {formatCents(cents)}
        </div>

        <div className={s.rowScroll} aria-label="Kategoria">
          {groups.map((g) => (
            <button key={g.id} className={groupId === g.id ? s.chipOn : s.chip} onClick={() => { setGroupId(g.id); setSubId(null); }}>
              <CategoryIcon name={g.icon} size={16} />
              {g.name}
            </button>
          ))}
        </div>
        {subs.length > 0 && (
          <div className={s.rowScroll} aria-label="Nënkategoria">
            {subs.map((c) => (
              <button key={c.id} className={subId === c.id ? s.subOn : s.sub} onClick={() => setSubId(subId === c.id ? null : c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className={s.pickers}>
          <div className={s.pickGroup}>
            <span className="meta">{kind === "expense" ? "Pagoi" : "Fitoi"}</span>
            <div className={s.pickRow}>
              {members.map((m) => (
                <button key={m.id} className={`${s.person} ${payer === m.id ? s.personOn : ""}`} data-color={m.color} onClick={() => setPayer(m.id)}>
                  <span className={s.dot} data-color={m.color}>{m.name.charAt(0)}</span>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <div className={s.pickGroup}>
            <span className="meta">Nga</span>
            <div className={s.pickRow}>
              {accounts.map((a) => (
                <button key={a.id} className={accountId === a.id ? s.subOn : s.sub} onClick={() => setAccountId(a.id)}>{a.name}</button>
              ))}
            </div>
          </div>
        </div>

        <input className={s.note} placeholder="Shënim (opsional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />

        <div className={s.keypad}>
          {KEYS.map((k) => (
            <button key={k} className={`${s.key} num`} onClick={() => press(k)} aria-label={k === "del" ? "Fshi" : k}>
              {k === "del" ? <Delete size={22} strokeWidth={1.75} /> : k}
            </button>
          ))}
        </div>

        <button className={s.save} disabled={!canSave} onClick={save}>
          {!groupId && cents > 0 ? "Zgjidh kategorinë" : "Ruaj"}
        </button>
      </div>
    </div>
  );
}
