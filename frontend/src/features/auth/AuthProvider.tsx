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
    const unsubscribe = subscribeToAuthState((nextSession) => {
      if (active) {
        hasAuthEvent = true;
        setSession(nextSession);
        setIsLoading(false);
      }
    });

    getCurrentAuthSession()
      .then((nextSession) => {
        if (active && !hasAuthEvent) {
          setSession(nextSession);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active && !hasAuthEvent) {
          setSession(null);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ isLoading, session }}>{children}</AuthContext.Provider>;
}
