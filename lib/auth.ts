"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ---------------- Session ----------------

// Set when the user opened a "reset password" link: the app then asks for a new password.
let recovery = false;
const recoverySubs = new Set<() => void>();
function setRecovery(v: boolean) {
  recovery = v;
  recoverySubs.forEach((f) => f());
}
export function useRecovery() {
  return useSyncExternalStore(
    (f) => { recoverySubs.add(f); return () => { recoverySubs.delete(f); }; },
    () => recovery,
    () => false
  );
}
export const clearRecovery = () => setRecovery(false);

// Current Supabase session, kept up to date. undefined while loading.
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export const displayName = (s: Session | null | undefined) => (s?.user.user_metadata?.name as string | undefined)?.trim() || "";

// ---------------- Actions ----------------

function sb() {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar");
  return supabase;
}
const norm = (email: string) => email.trim().toLowerCase();
const origin = () => (typeof window !== "undefined" ? window.location.origin : undefined);

// "signed-in" when email confirmation is off, "confirm" when Supabase sent a confirmation email.
export async function signUp(name: string, email: string, password: string): Promise<"signed-in" | "confirm"> {
  const { data, error } = await sb().auth.signUp({
    email: norm(email),
    password,
    options: { data: { name: name.trim() }, emailRedirectTo: origin() },
  });
  if (error) throw error;
  // Supabase hides whether an email exists; an empty identities list means it already does.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error("already registered");
  return data.session ? "signed-in" : "confirm";
}

export async function signIn(email: string, password: string): Promise<"signed-in" | "confirm"> {
  const { error } = await sb().auth.signInWithPassword({ email: norm(email), password });
  if (error) {
    if ((error as { code?: string }).code === "email_not_confirmed" || error.message.toLowerCase().includes("not confirmed")) return "confirm";
    throw error;
  }
  return "signed-in";
}

export async function confirmWithCode(email: string, token: string) {
  const first = await sb().auth.verifyOtp({ email: norm(email), token: token.trim(), type: "signup" });
  if (!first.error) return;
  const second = await sb().auth.verifyOtp({ email: norm(email), token: token.trim(), type: "email" });
  if (second.error) throw first.error;
}

export async function resendConfirmation(email: string) {
  const { error } = await sb().auth.resend({ type: "signup", email: norm(email), options: { emailRedirectTo: origin() } });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(norm(email), { redirectTo: origin() });
  if (error) throw error;
}

export async function resetWithCode(email: string, token: string, newPassword: string) {
  const { error } = await sb().auth.verifyOtp({ email: norm(email), token: token.trim(), type: "recovery" });
  if (error) throw error;
  await setNewPassword(newPassword);
}

export async function setNewPassword(password: string) {
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: "local" });
}

// ---------------- Errors in Albanian ----------------

export function authMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  const l = m.toLowerCase();
  if (l.includes("invalid login credentials")) return "Email-i ose fjalëkalimi nuk është i saktë.";
  if (l.includes("not confirmed")) return "Email-i nuk është konfirmuar ende.";
  if (l.includes("already registered") || l.includes("already been registered") || l.includes("already exists")) return "Ky email ka tashmë llogari. Hyr me fjalëkalimin tënd.";
  if (l.includes("password should") || l.includes("weak password") || l.includes("at least")) return "Fjalëkalimi duhet të ketë të paktën 8 shkronja.";
  if (l.includes("same password") || l.includes("different from the old")) return "Fjalëkalimi i ri duhet të jetë ndryshe nga i vjetri.";
  if (l.includes("rate limit") || l.includes("only request this after") || l.includes("too many")) return "Shumë kërkesa radhazi. Prit disa minuta dhe provo përsëri.";
  if (l.includes("expired") || l.includes("otp") || l.includes("token")) return "Kodi nuk është i saktë ose ka skaduar.";
  if (l.includes("failed to fetch") || l.includes("network") || l.includes("load failed")) return "Nuk ka lidhje me internetin. Provo përsëri.";
  if (l.includes("invalid email") || l.includes("unable to validate email") || l.includes("email address") && l.includes("invalid")) return "Email-i nuk duket i saktë.";
  if (l.includes("signups not allowed") || l.includes("signup is disabled") || l.includes("signups are disabled") || l.includes("provider is disabled")) return "Regjistrimi me email është i çaktivizuar në Supabase. Ndize te Authentication > Sign In / Providers.";
  if (l.includes("could not find the function") || l.includes("does not exist") || l.includes("schema cache")) return "Databaza nuk është gati. Ekzekuto të dy migrimet në Supabase (SQL Editor).";
  if (l.includes("invite invalid") || l.includes("kodi nuk")) return "Kodi i ftesës nuk është i saktë ose ka skaduar.";
  if (l.includes("member already joined")) return "Ky person është lidhur tashmë.";
  return m;
}
