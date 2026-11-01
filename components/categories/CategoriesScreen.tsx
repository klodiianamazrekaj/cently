"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  categoryUsage, createCategory, db, deleteCategory, setCategoryOrder, updateCategory, type Category,
} from "@/lib/db";
import { CAT_COLORS, catColor, colorName } from "@/lib/categoryStyle";
import { CATEGORY_ICONS, CategoryIcon } from "@/components/CategoryIcon";
import { CatTile } from "@/components/CatTile";
import s from "./categories.module.css";

type Kind = "expense" | "income";
export type CategoriesRequest = { kind: Kind; startNew?: boolean; onCreated?: (id: string) => void };

type SubDraft = { key: string; id: string | null; name: string; original: string; deleted: boolean };
type Draft = { id: string | null; name: string; icon: string; color: string; kind: Kind; subs: SubDraft[] };

const byOrder = (a: Category, b: Category) => a.sortOrder - b.sortOrder;
const COLOR_NAMES: Record<string, string> = {
  green: "Jeshile", teal: "Gurkali", cyan: "Cian", lime: "Limoni", yellow: "E verdhë", amber: "Qelibar",
  brown: "Kafe", pink: "Rozë", violet: "Vjollcë", slate: "Gri e errët", gray: "Gri",
};
const key = () => Math.random().toString(36).slice(2);

// Kategoritë: add, rename, reorder and delete categories and subcategories, with an icon and colour.
export function CategoriesScreen({ request, categories, onClose }: { request: CategoriesRequest | null; categories: Category[]; onClose: () => void }) {
  const [kind, setKind] = useState<Kind>("expense");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reorder, setReorder] = useState(false);

  const usage = useLiveQuery(async () => {
    const map = new Map<string, number>();
    await db.transactions.filter((t) => !t.deletedAt && !!t.categoryId).each((t) => map.set(t.categoryId!, (map.get(t.categoryId!) ?? 0) + 1));
    return map;
  }, []) ?? new Map<string, number>();

  const tops = useMemo(() => categories.filter((c) => !c.parentId && c.kind === kind).sort(byOrder), [categories, kind]);
  const subsOf = (id: string) => categories.filter((c) => c.parentId === id).sort(byOrder);

  const newDraft = (k: Kind): Draft => {
    const used = new Set(categories.filter((c) => !c.parentId).map((c) => colorName(c.icon, c.color)));
    return { id: null, name: "", icon: "other", color: CAT_COLORS.find((c) => !used.has(c)) ?? "gray", kind: k, subs: [] };
  };
  const editDraft = (c: Category): Draft => ({
    id: c.id, name: c.name, icon: c.icon, color: colorName(c.icon, c.color), kind: c.kind,
    subs: subsOf(c.id).map((x) => ({ key: x.id, id: x.id, name: x.name, original: x.name, deleted: false })),
  });

  // Open on the requested tab, straight into a new category when asked.
  useEffect(() => {
    if (!request) return;
    setKind(request.kind);
    setReorder(false);
    setDraft(request.startNew ? newDraft(request.kind) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") (draft && !request.startNew ? setDraft(null) : onClose()); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, draft, onClose]);

  if (!request) return null;

  const move = async (list: Category[], i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const ids = list.map((c) => c.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await setCategoryOrder(ids);
  };

  if (draft) {
    return (
      <Editor
        draft={draft}
        setDraft={setDraft}
        usage={usage}
        others={categories.filter((c) => !c.parentId && c.kind === draft.kind && c.id !== draft.id).sort(byOrder)}
        onBack={() => (request.startNew ? onClose() : setDraft(null))}
        onSaved={(id, created) => {
          if (created && request.onCreated) { request.onCreated(id); onClose(); return; }
          setDraft(null);
        }}
        onDeleted={() => setDraft(null)}
      />
    );
  }

  return (
    <div className={s.screen} role="dialog" aria-label="Kategoritë">
      <div className={s.top}>
        <button className={s.iconBtn} onClick={onClose} aria-label="Kthehu"><ArrowLeft size={22} strokeWidth={1.75} /></button>
        <h1 className={s.title}>Kategoritë</h1>
        <button className={s.textBtn} onClick={() => setReorder((v) => !v)} aria-pressed={reorder}>{reorder ? "U krye" : "Rendit"}</button>
      </div>

      <div className={s.tabs} role="tablist">
        {([["expense", "Shpenzime"], ["income", "Të ardhura"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={`${s.tab} ${kind === k ? s.tabOn : ""}`} onClick={() => setKind(k)}>{label}</button>
        ))}
      </div>

      <ul className={s.list}>
        {tops.map((c, i) => {
          const n = subsOf(c.id).length;
          return (
            <li key={c.id}>
              {reorder ? (
                <div className={s.row}>
                  <CatTile icon={c.icon} color={c.color} />
                  <span className={s.rowName}>{c.name}</span>
                  <button className={s.iconBtn} onClick={() => move(tops, i, -1)} disabled={i === 0} aria-label={`Lart ${c.name}`}><ArrowUp size={18} strokeWidth={1.75} /></button>
                  <button className={s.iconBtn} onClick={() => move(tops, i, 1)} disabled={i === tops.length - 1} aria-label={`Poshtë ${c.name}`}><ArrowDown size={18} strokeWidth={1.75} /></button>
                </div>
              ) : (
                <button className={s.row} onClick={() => setDraft(editDraft(c))}>
                  <CatTile icon={c.icon} color={c.color} />
                  <span className={s.rowName}>{c.name}</span>
                  {n > 0 && <span className={s.rowMeta}>{n}</span>}
                  <ChevronRight size={16} strokeWidth={2} className={s.chev} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!reorder && (
        <button className={s.addRow} onClick={() => setDraft(newDraft(kind))}>
          <span className={s.addIcon}><Plus size={18} strokeWidth={1.75} /></span>
          Kategori e re
        </button>
      )}
    </div>
  );
}

function Editor({
  draft, setDraft, usage, others, onBack, onSaved, onDeleted,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  usage: Map<string, number>;
  others: Category[];
  onBack: () => void;
  onSaved: (id: string, created: boolean) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [newSub, setNewSub] = useState("");
  const [orderSubs, setOrderSubs] = useState(false);
  const [askDelete, setAskDelete] = useState<number | null>(null); // expenses that would move
  const [askSub, setAskSub] = useState<string | null>(null);
  const { bg, fg } = catColor(draft.icon, draft.color);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const liveSubs = draft.subs.filter((x) => !x.deleted);
  const canSave = !!draft.name.trim() && !busy;

  const subUsage = (x: SubDraft) => (x.id ? usage.get(x.id) ?? 0 : 0);
  const removeSub = (x: SubDraft) => set({ subs: x.id ? draft.subs.map((y) => (y.key === x.key ? { ...y, deleted: true } : y)) : draft.subs.filter((y) => y.key !== x.key) });
  const moveSub = (i: number, dir: -1 | 1) => {
    const list = [...liveSubs];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    set({ subs: [...list, ...draft.subs.filter((x) => x.deleted)] });
  };
  const addSub = () => {
    const name = newSub.trim();
    if (!name) return;
    set({ subs: [...draft.subs, { key: key(), id: null, name, original: "", deleted: false }] });
    setNewSub("");
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    const name = draft.name.trim();
    let id = draft.id;
    const created = !id;
    if (!id) id = (await createCategory({ parentId: null, name, icon: draft.icon, color: draft.color, kind: draft.kind })).id;
    else await updateCategory(id, { name, icon: draft.icon, color: draft.color });
    const pending = newSub.trim() ? [...draft.subs, { key: key(), id: null, name: newSub.trim(), original: "", deleted: false }] : draft.subs;
    for (const x of pending) if (x.deleted && x.id) await deleteCategory(x.id);
    const order: string[] = [];
    for (const x of pending) {
      if (x.deleted) continue;
      const n = x.name.trim();
      if (x.id) {
        if (n && n !== x.original) await updateCategory(x.id, { name: n });
        order.push(x.id);
      } else if (n) {
        order.push((await createCategory({ parentId: id, name: n, icon: draft.icon, color: null, kind: draft.kind })).id);
      }
    }
    if (order.length) await setCategoryOrder(order);
    setBusy(false);
    onSaved(id, created);
  };

  const startDelete = async () => {
    if (!draft.id) return;
    const ids = [draft.id, ...draft.subs.filter((x) => x.id).map((x) => x.id!)];
    const n = await categoryUsage(ids);
    if (n === 0) { await deleteCategory(draft.id); onDeleted(); return; }
    setAskDelete(n);
  };

  return (
    <div className={s.screen} role="dialog" aria-label={draft.id ? "Ndrysho kategorinë" : "Kategori e re"}>
      <div className={s.top}>
        <button className={s.iconBtn} onClick={onBack} aria-label="Kthehu"><ArrowLeft size={22} strokeWidth={1.75} /></button>
        <h1 className={s.title}>{draft.id ? "Ndrysho" : "Kategori e re"}</h1>
        <button className={`${s.textBtn} ${s.save}`} onClick={save} disabled={!canSave} data-save-cat>Ruaj</button>
      </div>

      <div className={s.hero}>
        <span className={s.preview} style={{ background: bg, color: fg }}><CategoryIcon name={draft.icon} size={30} /></span>
        <input
          className={s.nameInput}
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Emri"
          aria-label="Emri i kategorisë"
          maxLength={32}
          autoFocus={!draft.id}
        />
      </div>

      <p className={s.label}>Ngjyra</p>
      <div className={s.swatches} role="radiogroup" aria-label="Ngjyra">
        {CAT_COLORS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={draft.color === c}
            aria-label={COLOR_NAMES[c] ?? c}
            className={s.swatch}
            style={{ background: `var(--cat-${c})` }}
            onClick={() => set({ color: c })}
          >
            {draft.color === c && <Check size={16} strokeWidth={2.5} color="var(--surface)" />}
          </button>
        ))}
      </div>

      <p className={s.label}>Ikona</p>
      <div className={s.icons} role="radiogroup" aria-label="Ikona">
        {CATEGORY_ICONS.map((i) => {
          const on = draft.icon === i.key;
          return (
            <button
              key={i.key}
              role="radio"
              aria-checked={on}
              aria-label={i.label}
              className={s.icon}
              style={on ? { background: bg, color: fg } : undefined}
              onClick={() => set({ icon: i.key })}
            >
              <i.Icon size={21} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>

      <div className={s.labelRow}>
        <p className={s.label}>Nënkategoritë</p>
        {liveSubs.length > 1 && <button className={s.textBtn} onClick={() => setOrderSubs((v) => !v)}>{orderSubs ? "U krye" : "Rendit"}</button>}
      </div>
      <ul className={s.list}>
        {liveSubs.map((x, i) => (
          <li key={x.key}>
            <div className={s.subRow}>
              <input
                className={s.subInput}
                value={x.name}
                onChange={(e) => set({ subs: draft.subs.map((y) => (y.key === x.key ? { ...y, name: e.target.value } : y)) })}
                aria-label="Emri i nënkategorisë"
                maxLength={32}
              />
              {orderSubs ? (
                <>
                  <button className={s.iconBtn} onClick={() => moveSub(i, -1)} disabled={i === 0} aria-label={`Lart ${x.name}`}><ArrowUp size={17} strokeWidth={1.75} /></button>
                  <button className={s.iconBtn} onClick={() => moveSub(i, 1)} disabled={i === liveSubs.length - 1} aria-label={`Poshtë ${x.name}`}><ArrowDown size={17} strokeWidth={1.75} /></button>
                </>
              ) : (
                <button className={s.iconBtn} onClick={() => (subUsage(x) > 0 ? setAskSub(x.key) : removeSub(x))} aria-label={`Fshi ${x.name}`}><Trash2 size={17} strokeWidth={1.75} /></button>
              )}
            </div>
            {askSub === x.key && (
              <div className={s.confirm}>
                <p>{subUsage(x)} {subUsage(x) === 1 ? "shpenzim kalon" : "shpenzime kalojnë"} te {draft.name || "kategoria"}.</p>
                <div className={s.btnRow}>
                  <button className={s.btn} onClick={() => setAskSub(null)}>Anulo</button>
                  <button className={s.btnDanger} onClick={() => { removeSub(x); setAskSub(null); }}>Fshi</button>
                </div>
              </div>
            )}
          </li>
        ))}
        <li>
          <div className={s.subRow}>
            <input
              className={s.subInput}
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
              placeholder="Shto nënkategori"
              aria-label="Nënkategori e re"
              maxLength={32}
            />
            <button className={s.iconBtn} onClick={addSub} disabled={!newSub.trim()} aria-label="Shto"><Plus size={18} strokeWidth={1.75} /></button>
          </div>
        </li>
      </ul>

      {draft.id && askDelete === null && (
        <button className={s.delete} onClick={startDelete}><Trash2 size={16} strokeWidth={1.75} /> Fshi kategorinë</button>
      )}

      {askDelete !== null && draft.id && (
        <div className={s.confirm}>
          <p><b>{askDelete} {askDelete === 1 ? "shpenzim përdor" : "shpenzime përdorin"} këtë kategori.</b> Ku të kalojnë?</p>
          <ul className={s.list}>
            {others.map((c) => (
              <li key={c.id}>
                <button className={s.row} onClick={async () => { await deleteCategory(draft.id!, c.id); onDeleted(); }}>
                  <CatTile icon={c.icon} color={c.color} />
                  <span className={s.rowName}>{c.name}</span>
                </button>
              </li>
            ))}
            <li>
              <button className={s.row} onClick={async () => { await deleteCategory(draft.id!, null); onDeleted(); }}>
                <CatTile icon="other" />
                <span className={s.rowName}>Pa kategori</span>
              </button>
            </li>
          </ul>
          <button className={s.btn} onClick={() => setAskDelete(null)}>Anulo</button>
        </div>
      )}
    </div>
  );
}
