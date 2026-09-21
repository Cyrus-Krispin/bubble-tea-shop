import { useEffect, useState, type ReactNode } from "react";

import { AuthContext } from "./AuthContext";
import { getCurrentAuthSession, subscribeToAuthState } from "./authClient";
import type { AuthSession } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let hasAuthEvent = false;
    let currentSession: AuthSession | null = null;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    function acceptSession(nextSession: AuthSession | null) {
      if (!active) return;
      clearTimeout(expiryTimer);
      currentSession = nextSession && Number.isFinite(nextSession.expiresAt)
        && nextSession.expiresAt * 1000 > Date.now() ? nextSession : null;
      setSession(currentSession);
      setIsLoading(false);
      if (currentSession) {
        expiryTimer = setTimeout(checkExpiry, Math.min(currentSession.expiresAt * 1000 - Date.now(), 2_147_483_647));
      }
    }
    function checkExpiry() {
      if (currentSession) acceptSession(currentSession);
    }
    window.addEventListener("focus", checkExpiry);
    document.addEventListener("visibilitychange", checkExpiry);
    const unsubscribe = subscribeToAuthState((nextSession) => {
      if (active) {
        hasAuthEvent = true;
        acceptSession(nextSession);
      }
    });

    getCurrentAuthSession()
      .then((nextSession) => {
        if (active && !hasAuthEvent) {
          acceptSession(nextSession);
        }
      })
      .catch(() => {
        if (active && !hasAuthEvent) {
          acceptSession(null);
        }
      });

    return () => {
      active = false;
      clearTimeout(expiryTimer);
      window.removeEventListener("focus", checkExpiry);
      document.removeEventListener("visibilitychange", checkExpiry);
      unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ isLoading, session }}>{children}</AuthContext.Provider>;
}
