"use client";

import { useState } from "react";
import { Check, Cloud, CloudOff, Copy, LogIn, LogOut, RefreshCw, Share2 } from "lucide-react";
import { authMessage, displayName } from "@/lib/auth";
import { createInvite, signOutAndClear, syncNow, useSyncState } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import { useShell } from "@/components/shell/MainShell";
import { AuthFlow } from "@/components/auth/AuthFlow";
import authStyles from "@/components/auth/auth.module.css";
import s from "./ui.module.css";

export function ProfileView() {
  const { lookups, household, session } = useShell();
  const sync = useSyncState();
  const [invite, setInvite] = useState<{ memberId: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ lost: number } | null>(null);
  const [relogin, setRelogin] = useState(false);

  const me = household ? lookups.memberById.get(household.memberId) : undefined;
  const name = me?.name || displayName(session) || "Ti";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(authMessage(e)); } finally { setBusy(false); }
  };

  const startSignOut = () => run(async () => {
    const lost = await signOutAndClear();
    if (lost > 0) setConfirm({ lost });
  });

  const syncTitle =
    sync.phase === "syncing" ? "Duke sinkronizuar…" : sync.phase === "offline" ? "Pa internet" : sync.phase === "error" ? "Sinkronizimi dështoi"
      : sync.phase === "off" ? "Joaktiv" : "Sinkronizuar";
  const syncSub =
    sync.phase === "error" && sync.error ? authMessage(sync.error) : sync.pending > 0 ? `${sync.pending} në pritje`
      : sync.lastSyncedAt ? ago(sync.lastSyncedAt) : null;

  return (
    <>
      <h1 className={s.pageTitle}>Profili</h1>

      <div className={s.profileHead}>
        <span className={s.bigAv} data-color={me?.color ?? "blue"}>{name.charAt(0).toUpperCase()}</span>
        <div className={s.grow}>
          <div className={s.name}>{name}</div>
          <div className={s.muted}>{session?.user.email ?? (supabase ? "Pa hyrë" : "Vetëm në këtë telefon")}</div>
        </div>
      </div>

      {supabase && !session && household && (
        <button className={`${s.relogin} press`} onClick={() => setRelogin(true)}>
          <LogIn size={18} strokeWidth={2} />
          <span>Hyr përsëri</span>
        </button>
      )}

      {household && (
        <>
          <p className={s.sectionLabel}>Shtëpia</p>
          <ul className={s.list}>
            {lookups.members.map((m) => {
              const isMe = m.id === household.memberId;
              const joined = !!m.userId || isMe;
              return (
                <li key={m.id}>
                  <div className={s.row}>
                    <span className={s.avatar} data-color={m.color} style={{ border: 0, width: 36, height: 36, fontSize: 14 }}>{m.name.charAt(0)}</span>
                    <div className={s.grow}>
                      <div className={s.rowTitle}>{m.name}{isMe ? " (ti)" : ""}</div>
                      {!joined && <div className={s.muted}>Pa u lidhur</div>}
                    </div>
                    {!joined && session && (
                      <button className={`${s.textBtn} press`} disabled={busy} onClick={() => run(async () => setInvite({ memberId: m.id, code: await createInvite(m.id) }))}>Fto</button>
                    )}
                  </div>
                  {invite?.memberId === m.id && (
                    <div className={s.invite}>
                      <div className={s.bigCode}>{invite.code}</div>
                      <p className={s.muted} style={{ margin: 0 }}>Vlen 7 ditë.</p>
                      <div className={s.btnRow}>
                        <button className={`${s.btn} press`} onClick={async () => {
                          try { await navigator.clipboard.writeText(invite.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
                        }}>
                          {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2} />} {copied ? "U kopjua" : "Kopjo"}
                        </button>
                        {typeof navigator !== "undefined" && "share" in navigator && (
                          <button className={`${s.btnInk} press`} onClick={() => navigator.share({ text: `Bashkohu me mua në Cently: ${location.origin}\nKodi i ftesës: ${invite.code}` }).catch(() => {})}>
                            <Share2 size={16} strokeWidth={2} /> Dërgo
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className={s.sectionLabel}>Sinkronizimi</p>
          <ul className={s.list}>
            <li className={s.row}>
              <span className={s.rowIcon} data-phase={sync.phase}>
                {sync.phase === "offline" || sync.phase === "error" || sync.phase === "off" ? <CloudOff size={17} strokeWidth={2} /> : <Cloud size={17} strokeWidth={2} />}
              </span>
              <div className={s.grow}>
                <div className={s.rowTitle}>{syncTitle}</div>
                {syncSub && <div className={s.muted}>{syncSub}</div>}
              </div>
              <button className={`${s.iconBtn} press`} onClick={() => syncNow()} disabled={sync.phase === "syncing" || !session} aria-label="Sinkronizo tani">
                <RefreshCw size={17} strokeWidth={2} className={sync.phase === "syncing" ? s.spin : ""} />
              </button>
            </li>
          </ul>
        </>
      )}

      {error && <p className={s.error} role="alert">{error}</p>}

      {supabase && (session || household) && !confirm && (
        <button className={`${s.signOut} press`} disabled={busy} onClick={startSignOut}>
          <LogOut size={17} strokeWidth={2} /> {busy ? "Duke dalë…" : "Dil"}
        </button>
      )}

      {confirm && (
        <div className={s.confirm}>
          <p><b>{confirm.lost} ndryshime pa u sinkronizuar.</b> Nëse del tani, humbasin.</p>
          <div className={s.btnRow}>
            <button className={`${s.btn} press`} onClick={() => setConfirm(null)}>Anulo</button>
            <button className={`${s.btnDanger} press`} onClick={() => run(async () => { await signOutAndClear({ force: true }); })}>Dil gjithsesi</button>
          </div>
        </div>
      )}

      {relogin && (
        <div className={authStyles.overlay}>
          <AuthFlow initial="login" onDone={() => setRelogin(false)} onCancel={() => setRelogin(false)} />
        </div>
      )}
    </>
  );
}

function ago(ts: number) {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return "Tani";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min më parë`;
  return `${Math.round(min / 60)} orë më parë`;
}
