"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Current Supabase session, kept up to date. undefined while loading.
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

// Sends a 6-digit code by email. A code (not a link) is used on purpose: on iPhone a link
// opens in Safari, not in the Cently app on the home screen, so you would end up signed in
// in the wrong place.
export async function sendCode(email: string) {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar");
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function verifyCode(email: string, token: string) {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar");
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: "email" });
  if (error) throw new Error(error.message.toLowerCase().includes("expired") || error.message.toLowerCase().includes("invalid") ? "Kodi nuk është i saktë ose ka skaduar" : error.message);
  return data.session;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
