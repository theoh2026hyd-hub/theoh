"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";
import { clearUserSessionStorage, notifySessionCleared } from "@/app/lib/userSessionStorage";
import { parseJsonResponse } from "@/app/lib/fetchJson";

async function validateRegisteredSession() {
  try {
    const res = await fetch("/api/auth/validate-session", {
      method: "POST",
      cache: "no-store",
    });
    return parseJsonResponse(res);
  } catch (err) {
    console.warn("Failed to validate session:", err?.message || err);
    return { success: false, error: err?.message || "Session validation failed." };
  }
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);

  const signOutUnregistered = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setRegistered(false);
    setNeedsPhone(false);
    clearUserSessionStorage();
    notifySessionCleared();
  }, []);

  const signOutAndClear = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setRegistered(false);
    setNeedsPhone(false);
    clearUserSessionStorage();
    notifySessionCleared();
  }, []);

  const applySessionValidation = useCallback(
    async (currentUser) => {
      if (!currentUser) {
        setRegistered(false);
        setNeedsPhone(false);
        return { ok: true, registered: false };
      }

      const data = await validateRegisteredSession();
      if (!data.success || !data.registered) {
        await signOutUnregistered();
        return { ok: false, registered: false, error: data.error };
      }

      setRegistered(true);
      setNeedsPhone(Boolean(data.needsPhone));
      return { ok: true, registered: true, needsPhone: Boolean(data.needsPhone) };
    },
    [signOutUnregistered]
  );

  const refreshAuth = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      setUser(null);
      setRegistered(false);
      setNeedsPhone(false);
      return null;
    }

    const result = await applySessionValidation(currentUser);
    if (result.ok) {
      setUser(currentUser);
    }
    return result;
  }, [applySessionValidation]);

  useEffect(() => {
    const supabase = createClient();

    const loadUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser) {
        const result = await applySessionValidation(currentUser);
        if (result.ok) {
          setUser(currentUser);
        }
      } else {
        setUser(null);
        setRegistered(false);
        setNeedsPhone(false);
      }

      setLoading(false);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      if (nextUser) {
        const result = await applySessionValidation(nextUser);
        if (result.ok) {
          setUser(nextUser);
        }
      } else {
        setUser(null);
        setRegistered(false);
        setNeedsPhone(false);
        clearUserSessionStorage();
        notifySessionCleared();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [applySessionValidation]);

  const clearNeedsPhone = useCallback(() => {
    setNeedsPhone(false);
  }, []);

  return {
    user,
    loading,
    registered,
    needsPhone,
    isLoggedIn: Boolean(user && registered),
    isProfileComplete: Boolean(user && registered && !needsPhone),
    refreshAuth,
    clearNeedsPhone,
    signOutUnregistered,
    signOutAndClear,
  };
}
