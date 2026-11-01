"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { authMessage, displayName } from "@/lib/auth";
import { adoptHousehold, createHousehold, findMyHousehold, joinWithCode, signOutAndClear } from "@/lib/sync";
import { useLookups } from "@/lib/data";
import s from "./auth.module.css";

type Step = "checking" | "choose" | "create" | "join";

// After signing in, before the app: find the household, or create one, or join with a code.
export function Onboarding({ session }: { session: Session }) {
  const { members } = useLookups();
  const [step, setStep] = useState<Step>("checking");
  const [myName, setMyName] = useState(displayName(session));
  const [partnerName, setPartnerName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already part of a household (new phone, or signed in again)? Load it straight away.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await findMyHousehold(session.user.id);
        if (existing) await adoptHousehold(existing, session.user.id);
        else if (!cancelled) setStep("choose");
      } catch (e) {
        if (!cancelled) { setError(authMessage(e)); setStep("choose"); }
      }
    })();
    return () => { cancelled = true; };
  }, [session.user.id]);

  // Prefill the partner's name with the other person on this phone.
  useEffect(() => {
    if (partnerName || members.length < 2) return;
    const mine = myName.trim().toLowerCase();
    const other = members.find((m) => m.name.toLowerCase() !== mine) ?? members[1];
    setPartnerName(other.name);
  }, [members, myName, partnerName]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(authMessage(e)); } finally { setBusy(false); }
  };

  const create = () => run(async () => {
    // "Me" is the person whose name matches, otherwise the first one; the other is the partner.
    const mine = myName.trim();
    const me = members.find((m) => m.name.toLowerCase() === mine.toLowerCase()) ?? members[0];
    const partner = members.find((m) => m.id !== me.id);
    const now = Date.now();
    await db.members.update(me.id, { name: mine, updatedAt: now, synced: 0 });
    if (partner && partnerName.trim()) await db.members.update(partner.id, { name: partnerName.trim(), updatedAt: now, synced: 0 });
    await createHousehold(session.user.id, me.id);
  });

  const back = (
    <button className={`${s.iconBtn} press`} onClick={() => { setError(null); setStep("choose"); }} aria-label="Kthehu">
      <ArrowLeft size={20} strokeWidth={2} />
    </button>
  );

  return (
    <div className={s.screen}>
      <div className={s.top}>{step === "create" || step === "join" ? back : <span className={s.iconSpace} />}<span className={s.iconSpace} /></div>

      {step === "checking" && (
        <div className={s.center}>
          <span className={s.spinner} />
          <p>Duke ngarkuar…</p>
        </div>
      )}

      {step === "choose" && (
        <div className={`${s.form} rise`}>
          <h1 className={s.h1}>Mirë se erdhe{myName ? `, ${myName}` : ""}</h1>
          <p className={s.lead}>Njëri krijon shtëpinë, tjetri bashkohet me kod.</p>
          <div className={s.choices}>
            <button className={`${s.choice} press`} onClick={() => setStep("create")}>
              <span className={s.choiceText}><b>Krijo shtëpinë</b><span>Je i pari</span></span>
              <ChevronRight size={18} strokeWidth={2} />
            </button>
            <button className={`${s.choice} press`} onClick={() => setStep("join")}>
              <span className={s.choiceText}><b>Kam një kod</b><span>Partneri të ka ftuar</span></span>
              <ChevronRight size={18} strokeWidth={2} />
            </button>
          </div>
          {error && <p className={s.error} role="alert">{error}</p>}
        </div>
      )}

      {step === "create" && (
        <form className={`${s.form} rise`} onSubmit={(e) => { e.preventDefault(); create(); }}>
          <h1 className={s.h1}>Shtëpia juaj</h1>
          <p className={s.lead}>Shpenzimet në këtë telefon ruhen.</p>
          <label className={s.field}>
            <span className={s.label}>Emri yt</span>
            <input className={s.input} value={myName} onChange={(e) => setMyName(e.target.value)} autoComplete="given-name" />
          </label>
          <label className={s.field}>
            <span className={s.label}>Emri i partnerit</span>
            <input className={s.input} value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
          </label>
          {error && <p className={s.error} role="alert">{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || members.length < 2 || !myName.trim() || !partnerName.trim()}>{busy ? "Duke krijuar…" : "Krijo shtëpinë"}</button>
        </form>
      )}

      {step === "join" && (
        <form className={`${s.form} rise`} onSubmit={(e) => { e.preventDefault(); run(() => joinWithCode(code, session.user.id)); }}>
          <h1 className={s.h1}>Kodi i ftesës</h1>
          <p className={s.lead}>Kodi është te Profili i partnerit.</p>
          <input
            className={`${s.input} ${s.code}`}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABC123"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            aria-label="Kodi i ftesës"
            autoFocus
          />
          {error && <p className={s.error} role="alert">{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || code.length !== 6}>{busy ? "Duke u bashkuar…" : "Bashkohu"}</button>
        </form>
      )}

      {step !== "checking" && (
        <p className={s.footer}>
          {session.user.email} · <button onClick={() => signOutAndClear({ force: true })}>Dil</button>
        </p>
      )}
    </div>
  );
}
