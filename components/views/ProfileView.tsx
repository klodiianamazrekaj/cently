"use client";

import { useState } from "react";
import { Check, Cloud, CloudOff, Copy, LogIn, LogOut, RefreshCw, Share2, UserPlus } from "lucide-react";
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

  return (
    <>
      <h1 className={s.pageTitle}>Profili</h1>

      <div className={s.card}>
        <div className={s.profileCard}>
          <span className={s.bigAv} data-color={me?.color ?? "blue"}>{name.charAt(0).toUpperCase() || "T"}</span>
          <div className={s.grow}>
            <div className={s.name}>{name}</div>
            <div className={s.muted}>{session?.user.email ?? (supabase ? "Pa hyrë" : "Vetëm në këtë telefon")}</div>
          </div>
        </div>
      </div>

      {!supabase && (
        <p className={s.localNote}>Shpenzimet ruhen vetëm në këtë telefon. Kur të lidhet llogaria, ato sinkronizohen me partnerin.</p>
      )}

      {supabase && !session && household && (
        <button className={`${s.reloginCard} press`} onClick={() => setRelogin(true)}>
          <LogIn size={20} strokeWidth={2} />
          <span><b>Hyr përsëri</b>Sesioni ka skaduar. Shpenzimet ruhen në telefon derisa të hysh.</span>
        </button>
      )}

      {household && (
        <>
          <p className={s.sectionLabel}>Shtëpia</p>
          <div className={s.card}>
            {lookups.members.map((m) => {
              const isMe = m.id === household.memberId;
              const joined = !!m.userId || isMe;
              return (
                <div key={m.id} className={s.rowDiv}>
                  <div className={s.row}>
                    <span className={s.avatar} data-color={m.color} style={{ border: 0 }}>{m.name.charAt(0)}</span>
                    <div className={s.grow}>
                      <div className={s.rowTitle}>{m.name}{isMe ? " (ti)" : ""}</div>
                      <div className={s.muted}>{joined ? "I lidhur" : "Ende jo i lidhur"}</div>
                    </div>
                    {!joined && session && (
                      <button className={`${s.smallBtn} ${s.smallBtnInk} press`} disabled={busy} onClick={() => run(async () => setInvite({ memberId: m.id, code: await createInvite(m.id) }))}>
                        <UserPlus size={16} strokeWidth={2} /> Fto
                      </button>
                    )}
                  </div>
                  {invite?.memberId === m.id && (
                    <div className={s.invite}>
                      <p className={s.muted}>Dërgoja këtë kod {m.name}-it. I duhet të krijojë llogari në Cently dhe të zgjedhë &quot;Kam një kod ftese&quot;. Vlen 7 ditë.</p>
                      <div className={`${s.bigCode} num`}>{invite.code}</div>
                      <div className={s.btnRow}>
                        <button className={`${s.btn} press`} onClick={async () => {
                          try { await navigator.clipboard.writeText(invite.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
                        }}>
                          {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2} />} {copied ? "U kopjua" : "Kopjo"}
                        </button>
                        {typeof navigator !== "undefined" && "share" in navigator && (
                          <button className={`${s.btnLime} press`} onClick={() => navigator.share({ text: `Bashkohu me mua në Cently: ${location.origin}\nKodi i ftesës: ${invite.code}` }).catch(() => {})}>
                            <Share2 size={16} strokeWidth={2} /> Dërgo
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className={s.sectionLabel}>Sinkronizimi</p>
          <div className={s.card}>
            <div className={s.row}>
              <span className={s.syncIcon} data-phase={sync.phase}>
                {sync.phase === "offline" || sync.phase === "error" || sync.phase === "off" ? <CloudOff size={18} strokeWidth={2} /> : <Cloud size={18} strokeWidth={2} />}
              </span>
              <div className={s.grow}>
                <div className={s.rowTitle}>
                  {sync.phase === "syncing" ? "Duke sinkronizuar…" : sync.phase === "offline" ? "Pa internet" : sync.phase === "error" ? "Sinkronizimi dështoi" : sync.phase === "off" ? "Joaktiv" : "Gjithçka e sinkronizuar"}
                </div>
                <div className={s.muted}>
                  {sync.phase === "error" && sync.error ? authMessage(sync.error) : sync.pending > 0 ? `${sync.pending} ndryshime në pritje` : sync.lastSyncedAt ? `Herën e fundit ${ago(sync.lastSyncedAt)}` : "Ende jo"}
                </div>
              </div>
              <button className={`${s.smallBtn} press`} onClick={() => syncNow()} disabled={sync.phase === "syncing" || !session} aria-label="Sinkronizo tani">
                <RefreshCw size={16} strokeWidth={2} className={sync.phase === "syncing" ? s.spin : ""} />
              </button>
            </div>
          </div>
        </>
      )}

      {error && <p className={s.error} role="alert">{error}</p>}

      {supabase && (session || household) && !confirm && (
        <button className={`${s.signOut} press`} disabled={busy} onClick={startSignOut}>
          <LogOut size={18} strokeWidth={2} /> {busy ? "Duke dalë…" : "Dil nga llogaria"}
        </button>
      )}

      {confirm && (
        <div className={s.confirm}>
          <p><b>{confirm.lost} ndryshime nuk janë sinkronizuar ende.</b> Nëse del tani, ato humbasin. Lidhu me internet dhe provo përsëri, ose dil gjithsesi.</p>
          <div className={s.btnRow}>
            <button className={`${s.btn} press`} onClick={() => setConfirm(null)}>Anulo</button>
            <button className={`${s.btnDanger} press`} onClick={() => run(async () => { await signOutAndClear({ force: true }); })}>Dil gjithsesi</button>
          </div>
        </div>
      )}

      <p className={s.version}>Cently · Çdo cent, bashkë</p>

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
  if (sec < 10) return "tani";
  if (sec < 60) return `${sec} sekonda më parë`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min më parë`;
  return `${Math.round(min / 60)} orë më parë`;
}
