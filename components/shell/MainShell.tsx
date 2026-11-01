"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useLiveQuery } from "dexie-react-hooks";
import { ChartPie, House, Plus, ReceiptText, UserRound } from "lucide-react";
import { deleteTransaction, getHousehold, restoreTransaction, type HouseholdMeta, type Transaction } from "@/lib/db";
import { useLookups, type Lookups } from "@/lib/data";
import { QuickAdd } from "@/components/QuickAdd";
import { CategoriesScreen, type CategoriesRequest } from "@/components/categories/CategoriesScreen";
import { HomeView } from "@/components/views/HomeView";
import { TransactionsView } from "@/components/views/TransactionsView";
import { StatsView } from "@/components/views/StatsView";
import { ProfileView } from "@/components/views/ProfileView";
import s from "./shell.module.css";

export type Tab = "home" | "tx" | "stats" | "profile";

type Shell = {
  tab: Tab;
  setTab: (t: Tab) => void;
  offset: number;              // month shown on Lëvizjet and Analiza (0 = this month)
  setOffset: (n: number) => void;
  openAdd: () => void;
  openEdit: (t: Transaction) => void;
  openCategories: () => void;
  remove: (id: string) => void;
  lookups: Lookups;
  household: HouseholdMeta | null;
  session: Session | null;
};

const ShellCtx = createContext<Shell | null>(null);
export function useShell() {
  const v = useContext(ShellCtx);
  if (!v) throw new Error("useShell outside MainShell");
  return v;
}

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Kreu", icon: House },
  { id: "tx", label: "Lëvizjet", icon: ReceiptText },
  { id: "stats", label: "Analiza", icon: ChartPie },
  { id: "profile", label: "Profili", icon: UserRound },
];

export function MainShell({ session }: { session: Session | null }) {
  const [tab, setTabState] = useState<Tab>("home");
  const [offset, setOffset] = useState(0);
  const [sheet, setSheet] = useState<{ editing: Transaction | null } | null>(null);
  const [undo, setUndo] = useState<{ id: string; key: number } | null>(null);
  const [catReq, setCatReq] = useState<CategoriesRequest | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const lookups = useLookups();
  const household = useLiveQuery(async () => (await getHousehold()) ?? null, []) ?? null;

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    scroller.current?.scrollTo({ top: 0 });
  }, []);

  const remove = useCallback((id: string) => {
    deleteTransaction(id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ id, key: Date.now() });
    undoTimer.current = setTimeout(() => setUndo(null), 4500);
  }, []);

  // After saving, Lëvizjet and Analiza show the month the expense belongs to.
  const onSaved = useCallback((ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    setOffset((d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
  }, []);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const value = useMemo<Shell>(
    () => ({
      tab, setTab, offset, setOffset,
      openAdd: () => setSheet({ editing: null }),
      openEdit: (t) => setSheet({ editing: t }),
      openCategories: () => setCatReq({ kind: "expense" }),
      remove, lookups, household, session,
    }),
    [tab, setTab, offset, remove, lookups, household, session]
  );

  return (
    <ShellCtx.Provider value={value}>
      <div ref={scroller} className={s.scroller}>
        <main className={s.main}>
          <div key={tab} className={s.view}>
            {tab === "home" && <HomeView />}
            {tab === "tx" && <TransactionsView />}
            {tab === "stats" && <StatsView />}
            {tab === "profile" && <ProfileView />}
          </div>
        </main>
      </div>

      {undo && (
        <div key={undo.key} className={s.toast} role="status">
          <span>Shpenzimi u fshi</span>
          <button
            className="press"
            onClick={() => {
              restoreTransaction(undo.id);
              setUndo(null);
              if (undoTimer.current) clearTimeout(undoTimer.current);
            }}
          >
            Zhbëj
          </button>
        </div>
      )}

      <nav className={s.tabbar} aria-label="Navigimi">
        {TABS.slice(0, 2).map((t) => <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />)}
        <div className={s.addSlot}>
          <button className={`${s.add} press`} onClick={() => setSheet({ editing: null })} aria-label="Shto shpenzim">
            <Plus size={24} strokeWidth={2.2} />
          </button>
        </div>
        {TABS.slice(2).map((t) => <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />)}
      </nav>

      <QuickAdd
        open={!!sheet}
        editing={sheet?.editing ?? null}
        onClose={() => setSheet(null)}
        onSaved={onSaved}
        onNewCategory={(kind, done) => setCatReq({ kind, startNew: true, onCreated: done })}
        defaultPayer={household?.memberId ?? null}
        members={lookups.members}
        accounts={lookups.accounts}
        categories={lookups.categories}
      />
      <CategoriesScreen request={catReq} categories={lookups.categories} onClose={() => setCatReq(null)} />
    </ShellCtx.Provider>
  );
}

function TabButton({ t, active, onClick }: { t: (typeof TABS)[number]; active: boolean; onClick: () => void }) {
  const Icon = t.icon;
  return (
    <button className={`${s.tab} ${active ? s.tabOn : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <span className={s.tabIcon}><Icon size={22} strokeWidth={active ? 2.1 : 1.6} /></span>
      <span className={s.tabLabel}>{t.label}</span>
    </button>
  );
}
