"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, MailCheck, Users, WifiOff, X, Zap } from "lucide-react";
import {
  authMessage, clearRecovery, confirmWithCode, resendConfirmation, resetWithCode,
  sendPasswordReset, setNewPassword, signIn, signUp,
} from "@/lib/auth";
import { Mark } from "@/components/Mark";
import s from "./auth.module.css";

type Step = "welcome" | "signup" | "login" | "verify" | "forgot" | "reset" | "newPassword";

type Props = {
  initial?: Step;
  onDone?: () => void;    // used when shown on top of the app (signing in again)
  onCancel?: () => void;
};

export function AuthFlow({ initial = "welcome", onDone, onCancel }: Props) {
  const [step, setStep] = useState<Step>(initial);
  const [from, setFrom] = useState<Step>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const go = (next: Step) => { setError(null); setNotice(null); setCode(""); setStep(next); };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setNotice(null);
    try { await fn(); } catch (e) { setError(authMessage(e)); } finally { setBusy(false); }
  };

  // If the confirmation link was opened (often in Safari), coming back here signs in with the password.
  useEffect(() => {
    if (step !== "verify" || !password) return;
    const tryAgain = () => {
      if (document.visibilityState !== "visible") return;
      signIn(email, password).then((r) => { if (r === "signed-in") onDone?.(); }).catch(() => {});
    };
    document.addEventListener("visibilitychange", tryAgain);
    return () => document.removeEventListener("visibilitychange", tryAgain);
  }, [step, email, password, onDone]);

  const back: Partial<Record<Step, Step>> = { signup: "welcome", login: "welcome", verify: from, forgot: "login", reset: "forgot" };
  const canGoBack = step !== "welcome" && step !== "newPassword" && !(step === initial && onCancel);
  const pwOk = password.length >= 8;

  return (
    <div className={s.screen}>
      <div className={s.top}>
        {canGoBack && back[step] ? (
          <button className={`${s.iconBtn} press`} onClick={() => go(back[step]!)} aria-label="Kthehu"><ArrowLeft size={20} strokeWidth={2} /></button>
        ) : <span className={s.iconSpace} />}
        {onCancel ? (
          <button className={`${s.iconBtn} press`} onClick={onCancel} aria-label="Mbyll"><X size={20} strokeWidth={2} /></button>
        ) : <span className={s.iconSpace} />}
      </div>

      {step === "welcome" && (
        <div className={`${s.welcome} rise`}>
          <div className={s.brand}>
            <span className={s.markWrap}><Mark size={84} /></span>
            <span className={s.wordmark}>cently</span>
            <p className={s.tagline}>Çdo cent, bashkë.</p>
          </div>
          <ul className={s.points}>
            <li><span><Zap size={18} strokeWidth={2} /></span>Shto një shpenzim në pak sekonda</li>
            <li><span><Users size={18} strokeWidth={2} /></span>Të dy shihni të njëjtat shifra, live</li>
            <li><span><WifiOff size={18} strokeWidth={2} /></span>Punon edhe pa internet</li>
          </ul>
          <div className={s.actions}>
            <button className={`${s.primary} press`} onClick={() => go("signup")}>Krijo llogari</button>
            <button className={`${s.ghost} press`} onClick={() => go("login")}>Kam llogari, hyr</button>
          </div>
        </div>
      )}

      {step === "signup" && (
        <form className={`${s.form} rise`} onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await signUp(name, email, password);
            if (r === "confirm") { setFrom("signup"); go("verify"); } else onDone?.();
          });
        }}>
          <h1 className={s.h1}>Krijo llogarinë</h1>
          <p className={s.lead}>Vetëm disa sekonda. Pastaj ftoni njëri-tjetrin.</p>
          <Field label="Emri" value={name} onChange={setName} autoComplete="given-name" placeholder="Klodiana" autoFocus />
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" inputMode="email" placeholder="emri@shembull.com" />
          <PasswordField label="Fjalëkalimi" value={password} onChange={setPassword} autoComplete="new-password" hint={password && !pwOk ? "Të paktën 8 shkronja" : undefined} />
          {error && <p className={s.error} role="alert">{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || !name.trim() || !email.includes("@") || !pwOk}>
            {busy ? "Duke krijuar…" : "Krijo llogarinë"}
          </button>
          <p className={s.switch}>Ke llogari? <button type="button" onClick={() => go("login")}>Hyr</button></p>
        </form>
      )}

      {step === "login" && (
        <form className={`${s.form} rise`} onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await signIn(email, password);
            if (r === "confirm") { setFrom("login"); await resendConfirmation(email).catch(() => {}); go("verify"); } else onDone?.();
          });
        }}>
          <h1 className={s.h1}>Mirë se u ktheve</h1>
          <p className={s.lead}>Hyr me email-in dhe fjalëkalimin tënd.</p>
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" inputMode="email" placeholder="emri@shembull.com" autoFocus />
          <PasswordField label="Fjalëkalimi" value={password} onChange={setPassword} autoComplete="current-password" />
          <button type="button" className={s.forgot} onClick={() => go("forgot")}>Ke harruar fjalëkalimin?</button>
          {error && <p className={s.error} role="alert">{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || !email.includes("@") || !password}>{busy ? "Duke hyrë…" : "Hyr"}</button>
          {!onCancel && <p className={s.switch}>S&apos;ke llogari? <button type="button" onClick={() => go("signup")}>Krijo një</button></p>}
        </form>
      )}

      {step === "verify" && (
        <form className={`${s.form} rise`} onSubmit={(e) => { e.preventDefault(); run(async () => { await confirmWithCode(email, code); onDone?.(); }); }}>
          <span className={s.bigIcon}><MailCheck size={28} strokeWidth={1.75} /></span>
          <h1 className={s.h1}>Konfirmo email-in</h1>
          <p className={s.lead}>Të dërguam një email te <b>{email}</b>. Shkruaj kodin nga email-i, ose hape linkun dhe kthehu këtu.</p>
          <input
            className={`${s.input} ${s.code}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            aria-label="Kodi"
            autoFocus
          />
          {error && <p className={s.error} role="alert">{error}</p>}
          {notice && <p className={s.notice}>{notice}</p>}
          <button className={`${s.primary} press`} disabled={busy || code.length < 6}>{busy ? "Duke kontrolluar…" : "Konfirmo"}</button>
          <button type="button" className={`${s.ghost} press`} disabled={busy || !password} onClick={() => run(async () => {
            const r = await signIn(email, password);
            if (r === "confirm") setError("Email-i nuk është konfirmuar ende. Hape linkun në email ose shkruaj kodin.");
            else onDone?.();
          })}>E hapa linkun, vazhdo</button>
          <p className={s.switch}>Nuk erdhi? Shiko te Spam, ose <button type="button" disabled={busy} onClick={() => run(async () => { await resendConfirmation(email); setNotice("U dërgua përsëri."); })}>dërgoje përsëri</button></p>
        </form>
      )}

      {step === "forgot" && (
        <form className={`${s.form} rise`} onSubmit={(e) => { e.preventDefault(); run(async () => { await sendPasswordReset(email); go("reset"); }); }}>
          <h1 className={s.h1}>Rivendos fjalëkalimin</h1>
          <p className={s.lead}>Shkruaj email-in dhe do të të dërgojmë një kod.</p>
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" inputMode="email" placeholder="emri@shembull.com" autoFocus />
          {error && <p className={s.error} role="alert">{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || !email.includes("@")}>{busy ? "Duke dërguar…" : "Dërgo kodin"}</button>
        </form>
      )}

      {step === "reset" && (
        <form className={`${s.form} rise`} onSubmit={(e) => { e.preventDefault(); run(async () => { await resetWithCode(email, code, newPw); onDone?.(); }); }}>
          <h1 className={s.h1}>Fjalëkalim i ri</h1>
          <p className={s.lead}>Shkruaj kodin që të dërguam te <b>{email}</b> dhe zgjidh një fjalëkalim të ri.</p>
          <input
            className={`${s.input} ${s.code}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            aria-label="Kodi"
            autoFocus
          />
          <PasswordField label="Fjalëkalimi i ri" value={newPw} onChange={setNewPw} autoComplete="new-password" hint={newPw && newPw.length < 8 ? "Të paktën 8 shkronja" : undefined} />
          {error && <p className={s.error} role="alert">{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || code.length < 6 || newPw.length < 8}>{busy ? "Duke ruajtur…" : "Ruaj dhe hyr"}</button>
        </form>
      )}

      {step === "newPassword" && (
        <form className={`${s.form} rise`} onSubmit={(e) => { e.preventDefault(); run(async () => { await setNewPassword(newPw); clearRecovery(); onDone?.(); }); }}>
          <h1 className={s.h1}>Fjalëkalim i ri</h1>
          <p className={s.lead}>Zgjidh fjalëkalimin e ri për llogarinë tënde.</p>
          <PasswordField label="Fjalëkalimi i ri" value={newPw} onChange={setNewPw} autoComplete="new-password" hint={newPw && newPw.length < 8 ? "Të paktën 8 shkronja" : undefined} />
          {error && <p className={s.error} role="alert">{error}</p>}
          <button className={`${s.primary} press`} disabled={busy || newPw.length < 8}>{busy ? "Duke ruajtur…" : "Ruaj"}</button>
        </form>
      )}
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "email" | "text";
  placeholder?: string;
  autoFocus?: boolean;
};

function Field({ label, value, onChange, type = "text", ...rest }: FieldProps) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      <input className={s.input} type={type} value={value} onChange={(e) => onChange(e.target.value)} autoCapitalize={type === "email" ? "none" : "words"} {...rest} />
    </label>
  );
}

function PasswordField({ label, value, onChange, autoComplete, hint }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      <span className={s.pwWrap}>
        <input
          className={s.input}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          placeholder="••••••••"
        />
        <button type="button" className={s.eye} onClick={() => setShow((v) => !v)} aria-label={show ? "Fshih fjalëkalimin" : "Shfaq fjalëkalimin"}>
          {show ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
        </button>
      </span>
      {hint && <span className={s.hint}>{hint}</span>}
    </label>
  );
}
