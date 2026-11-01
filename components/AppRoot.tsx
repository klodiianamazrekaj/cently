"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureSeed, getHousehold } from "@/lib/db";
import { useRecovery, useSession } from "@/lib/auth";
import { startSync, stopSync } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import { AuthFlow } from "@/components/auth/AuthFlow";
import { Onboarding } from "@/components/auth/Onboarding";
import { MainShell } from "@/components/shell/MainShell";
import { Mark } from "@/components/Mark";

// Decides what to show:
// not signed in -> welcome, sign up, log in
// signed in, no household yet -> create one or join with a code
// household on this phone -> the app (works offline even if the session expired)
export function AppRoot() {
  const session = useSession();
  const recovery = useRecovery();
  const household = useLiveQuery(async () => (await getHousehold()) ?? null, []); // undefined = loading

  useEffect(() => { ensureSeed(); }, []);

  const syncKey = session && household ? `${session.user.id}:${household.householdId}` : null;
  useEffect(() => {
    if (syncKey) startSync();
    else stopSync();
  }, [syncKey]);

  if (!supabase) return <MainShell session={null} />;
  if (recovery && session) return <AuthFlow initial="newPassword" />;
  if (session === undefined || household === undefined) return <Splash />;
  if (household) return <MainShell session={session} />;
  if (!session) return <AuthFlow />;
  return <Onboarding session={session} />;
}

function Splash() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", color: "var(--ink)" }}>
      <Mark size={56} />
    </div>
  );
}
