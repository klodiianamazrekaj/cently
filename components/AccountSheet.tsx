"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, Check, Cloud, CloudOff, Copy, LogOut, RefreshCw, Share2, UserPlus, X } from "lucide-react";
import { db, getHousehold } from "@/lib/db";
import { sendCode, signOut, verifyCode } from "@/lib/auth";
import { createHousehold, createInvite, findMyHousehold, adoptHousehold, joinWithCode, leaveOnThisPhone, startSync, syncNow, useSyncState } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import s from "./AccountSheet.module.css";

type Step = "intro" | "email" | "code" | "setup" | "join" | "settings";

export function AccountSheet({ open, onClose, session }: { open: boolean; onClose: () => void; session: Session | null | undefined }) {
  const household = useLiveQuery(async () => (await getHousehold()) ?? null, []); // undefined = loading, null = none
  const members = (useLiveQuery(() => db.members.filter((m) => !m.deletedAt).toArray(), []) ?? []).sort((a, b) => a.color.localeCompare(b.color));
  const sync = useSyncState();

  const [step, setStep] = useState<Step>("intro");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<{ memberId: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Pick the right screen whenever the sheet opens or the sign-in state changes.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (session && household) setStep("settings");
    else if (session) setStep("setup");
    else setStep((st) => (st === "code" || st === "email" ? st : "intro"));
  }, [open, session, household]);

  useEffect(() => { if (!me && members[0]) setMe(members[0].id); }, [members, me]);

  if (!open) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const afterSignIn = async (sess: Session) => {
    const existing = await findMyHousehold(sess.user.id);
    if (existing) {
      const local = await getHousehold();
      if (local?.householdId === existing) await startSync();
      else await adoptHousehold(existing, sess.user.id);
      setStep("settings");
    } else {
      setStep("setup");
    }
  };

  const myMember = household ? members.find((m) => m.id === household.memberId) : undefined;
  const shareText = (c: string) => `Hyr në Cently: ${location.origin}\nKodi yt: ${c}`;

  return (
    <div className={s.screen} role="dialog" aria-label="Llogaria">
      <div className={s.top}>
        {(step === "email" || step === "code" || step === "join") ? (
          <button className={`${s.icon} press`} onClick={() => setStep(step === "code" ? "email" : step === "join" ? "setup" : "intro")} aria-label="Kthehu"><ArrowLeft size={20} strokeWidth={2} /></button>
        ) : <span className={s.icon} />}
        <span className={s.title}>{step === "settings" ? "Llogaria" : "Cently për dy"}</span>
        <button className={`${s.icon} press`} onClick={onClose} aria-label="Mbyll"><X size={20} strokeWidth={2} /></button>
      </div>

      {!supabase && (
        <div className={s.body}>
          <p className={s.lead}>Sinkronizimi nuk është konfiguruar në këtë version.</p>
        </div>
      )}

      {supabase && step === "intro" && (
        <div className={s.body}>
          <div className={s.hero}>
            <div className={s.pair}>
              {members.map((m) => <span key={m.id} className={s.bigAv} data-color={m.color}>{m.name.charAt(0)}</span>)}
            </div>
            <h1 className={s.h1}>Çdo cent, bashkë</h1>
            <p className={s.lead}>Lidhuni të dy dhe çdo shpenzim që shton njëri shfaqet menjëherë te tjetri. Të dhënat ruhen të sigurta dhe aplikacioni punon edhe pa internet.</p>
          </div>
          <button className={`${s.primary} press`} onClick={() => setStep("email")}>Vazhdo me email</button>
        </div>
      )}

      {supabase && step === "email" && (
        <form className={s.body} onSubmit={(e) => { e.preventDefault(); run(async () => { await sendCode(email); setCode(""); setStep("code"); }); }}>
          <h1 className={s.h1}>Email-i yt</h1>
          <p className={s.lead}>Do të të dërgojmë një kod për të hyrë. Pa fjalëkalim.</p>
          <input className={s.input} type="email" inputMode="email" autoComplete="email" placeholder="emri@shembull.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          {error && <p className={s.error}>{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || !email.includes("@")}>{busy ? "Duke dërguar…" : "Dërgo kodin"}</button>
        </form>
      )}

      {supabase && step === "code" && (
        <form className={s.body} onSubmit={(e) => { e.preventDefault(); run(async () => { const sess = await verifyCode(email, code); if (sess) await afterSignIn(sess); }); }}>
          <h1 className={s.h1}>Shkruaj kodin</h1>
          <p className={s.lead}>Kodi u dërgua te <b>{email}</b>. Shiko edhe te Spam.</p>
          <input
            className={`${s.input} ${s.codeInput}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          {error && <p className={s.error}>{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || code.length < 6}>{busy ? "Duke kontrolluar…" : "Hyr"}</button>
          <button type="button" className={s.link} disabled={busy} onClick={() => run(() => sendCode(email))}>Dërgoje kodin përsëri</button>
        </form>
      )}

      {supabase && step === "setup" && session && (
        <div className={s.body}>
          <h1 className={s.h1}>Kush je ti?</h1>
          <p className={s.lead}>Zgjidh veten. Shpenzimet e reja në këtë telefon do të dalin si të paguara nga ti.</p>
          <div className={s.choices}>
            {members.map((m) => (
              <button key={m.id} className={`${s.choice} press ${me === m.id ? s.choiceOn : ""}`} onClick={() => setMe(m.id)}>
                <span className={s.av} data-color={m.color}>{m.name.charAt(0)}</span>
                {m.name}
                {me === m.id && <Check size={18} strokeWidth={2.5} className={s.check} />}
              </button>
            ))}
          </div>
          {error && <p className={s.error}>{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || !me} onClick={() => run(async () => { await createHousehold(session.user.id, me!); setStep("settings"); })}>
            {busy ? "Duke krijuar…" : "Krijo shtëpinë tonë"}
          </button>
          <div className={s.or}><span>ose</span></div>
          <button className={`${s.secondary} press`} onClick={() => { setInvite(""); setStep("join"); }}>Kam një kod nga partneri</button>
          <button className={s.link} onClick={() => run(async () => { await signOut(); setStep("intro"); })}>Dil ({session.user.email})</button>
        </div>
      )}

      {supabase && step === "join" && session && (
        <form className={s.body} onSubmit={(e) => { e.preventDefault(); run(async () => { await joinWithCode(invite, session.user.id); setStep("settings"); }); }}>
          <h1 className={s.h1}>Kodi i ftesës</h1>
          <p className={s.lead}>Shkruaj kodin 6 shkronjësh që ta dha partneri. Shpenzimet që ke në këtë telefon do të ruhen dhe bashkohen.</p>
          <input
            className={`${s.input} ${s.codeInput}`}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABC123"
            maxLength={6}
            value={invite}
            onChange={(e) => setInvite(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            autoFocus
          />
          {error && <p className={s.error}>{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || invite.length !== 6}>{busy ? "Duke u bashkuar…" : "Bashkohu"}</button>
        </form>
      )}

      {supabase && step === "settings" && session && household && (
        <div className={s.body}>
          <div className={s.card}>
            <div className={s.profile}>
              {myMember && <span className={s.bigAv} data-color={myMember.color}>{myMember.name.charAt(0)}</span>}
              <div>
                <div className={s.name}>{myMember?.name ?? "Ti"}</div>
                <div className={s.muted}>{session.user.email}</div>
              </div>
            </div>
          </div>

          <h2 className={s.h2}>Sinkronizimi</h2>
          <div className={s.card}>
            <div className={s.row}>
              <span className={s.syncIcon} data-phase={sync.phase}>
                {sync.phase === "offline" || sync.phase === "error" ? <CloudOff size={18} strokeWidth={2} /> : <Cloud size={18} strokeWidth={2} />}
              </span>
              <div className={s.grow}>
                <div className={s.rowTitle}>
                  {sync.phase === "syncing" ? "Duke sinkronizuar…" : sync.phase === "offline" ? "Pa internet" : sync.phase === "error" ? "Sinkronizimi dështoi" : "Gjithçka e sinkronizuar"}
                </div>
                <div className={s.muted}>
                  {sync.phase === "error" && sync.error ? sync.error : sync.pending > 0 ? `${sync.pending} ndryshime në pritje` : sync.lastSyncedAt ? `Herën e fundit ${ago(sync.lastSyncedAt)}` : "Ende jo"}
                </div>
              </div>
              <button className={`${s.small} press`} onClick={() => syncNow()} disabled={sync.phase === "syncing"} aria-label="Sinkronizo tani">
                <RefreshCw size={16} strokeWidth={2} className={sync.phase === "syncing" ? s.spin : ""} />
              </button>
            </div>
          </div>

          <h2 className={s.h2}>Shtëpia</h2>
          <div className={s.card}>
            {members.map((m) => {
              const joined = !!m.userId || m.id === household.memberId;
              return (
                <div key={m.id} className={s.member}>
                  <div className={s.row}>
                    <span className={s.av} data-color={m.color}>{m.name.charAt(0)}</span>
                    <div className={s.grow}>
                      <div className={s.rowTitle}>{m.name}{m.id === household.memberId ? " (ti)" : ""}</div>
                      <div className={s.muted}>{joined ? "I lidhur" : "Ende jo i lidhur"}</div>
                    </div>
                    {!joined && (
                      <button className={`${s.small} ${s.smallText} press`} disabled={busy} onClick={() => run(async () => setInviteCode({ memberId: m.id, code: await createInvite(m.id) }))}>
                        <UserPlus size={16} strokeWidth={2} /> Fto
                      </button>
                    )}
                  </div>
                  {inviteCode?.memberId === m.id && (
                    <div className={s.invite}>
                      <p className={s.muted}>Dërgoja këtë kod {m.name}-it. I duhet ta hapë Cently-n, të hyjë me email-in e vet dhe të zgjedhë "Kam një kod nga partneri". Vlen 7 ditë.</p>
                      <div className={`${s.bigCode} num`}>{inviteCode.code}</div>
                      <div className={s.inviteActions}>
                        <button
                          className={`${s.secondary} press`}
                          onClick={async () => {
                            try { await navigator.clipboard.writeText(inviteCode.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
                          }}
                        >
                          {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2} />} {copied ? "U kopjua" : "Kopjo"}
                        </button>
                        {typeof navigator !== "undefined" && "share" in navigator && (
                          <button className={`${s.primary} press`} onClick={() => navigator.share({ text: shareText(inviteCode.code) }).catch(() => {})}>
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

          {error && <p className={s.error}>{error}</p>}

          <button
            className={`${s.danger} press`}
            onClick={() => run(async () => { await leaveOnThisPhone(); await signOut(); setStep("intro"); })}
          >
            <LogOut size={16} strokeWidth={2} /> Dil nga llogaria
          </button>
          <p className={s.footnote}>Kur del, shpenzimet mbeten në këtë telefon por nuk sinkronizohen më derisa të hysh përsëri.</p>
        </div>
      )}
    </div>
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
