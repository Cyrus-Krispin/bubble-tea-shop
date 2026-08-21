import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet } from "react-router";

import { Button, ProblemState } from "../../components/ui";
import { signOut } from "../auth/authClient";
import { useAuth } from "../auth/useAuth";
import {
  getStaffContext,
  StaffContextError,
  type StaffContext,
} from "./staffClient";
import "./staff.css";

type ContextState =
  | { status: "idle" | "loading" }
  | { status: "ready"; accessToken: string; context: StaffContext }
  | { status: "error"; accessToken: string; error: unknown };

export type StaffOutletContext = {
  accessToken: string;
  staffContext: StaffContext;
};

export function StaffLayout() {
  const { isLoading: isSessionLoading, session } = useAuth();
  const [contextState, setContextState] = useState<ContextState>({ status: "idle" });
  const [requestVersion, setRequestVersion] = useState(0);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const accessToken = session?.accessToken ?? null;

  useEffect(() => {
    if (accessToken === null) return;
    const controller = new AbortController();
    getStaffContext(accessToken, controller.signal)
      .then((context) => {
        if (!controller.signal.aborted) {
          setContextState({ status: "ready", accessToken, context });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setContextState({ status: "error", accessToken, error });
      });
    return () => controller.abort();
  }, [accessToken, requestVersion]);

  if (isSessionLoading) {
    return <main aria-label="Staff workspace" className="staff-status"><p role="status">Checking your session…</p></main>;
  }
  if (session === null) return <Navigate replace to="/staff/sign-in" />;

  const visibleState = (
    (contextState.status === "ready" || contextState.status === "error")
    && contextState.accessToken !== accessToken
  ) ? { status: "loading" as const } : contextState;

  async function handleSignOut() {
    setSignOutFailed(false);
    try {
      await signOut();
    } catch {
      setSignOutFailed(true);
    }
  }

  const accessError = visibleState.status === "error"
    && visibleState.error instanceof StaffContextError
    && visibleState.error.status === 403;

  return (
    <div className="staff-shell">
      <a className="skip-link" href="#staff-workspace">Skip to workspace</a>
      <header className="staff-header">
        <Link className="staff-brand" to="/staff" aria-label="Bubble Tea Shop staff home">
          <span className="brand-mark" aria-hidden="true">BT</span>
          <span><strong>Bubble Tea Shop</strong><small>Operations</small></span>
        </Link>
        <nav aria-label="Staff navigation">
          <NavLink end to="/staff">Overview</NavLink>
          <NavLink to="/staff/catalog">Catalog</NavLink>
          <NavLink to="/staff/inventory">Inventory</NavLink>
          <NavLink to="/staff/orders">Orders</NavLink>
        </nav>
        <div className="staff-account">
          <span>{session.email}</span>
          <Button onClick={handleSignOut} size="compact" variant="secondary">Sign out</Button>
        </div>
      </header>

      {signOutFailed ? <p className="staff-global-message form-message form-message--error" role="alert">We couldn&apos;t sign you out. Please try again.</p> : null}
      {visibleState.status === "idle" || visibleState.status === "loading" ? (
        <main aria-label="Staff workspace" className="staff-status" id="staff-workspace">
          <p role="status">Loading your access…</p>
        </main>
      ) : null}
      {visibleState.status === "error" ? (
        <main aria-label="Staff workspace" className="staff-status" id="staff-workspace">
          <ProblemState
            actionLabel={accessError ? "Sign out" : "Try again"}
            message={accessError
              ? "Your identity is signed in, but it does not have an active staff membership."
              : "We couldn’t load your current permissions. Try again before using staff tools."}
            onRetry={accessError ? handleSignOut : () => {
              setContextState({ status: "loading" });
              setRequestVersion((value) => value + 1);
            }}
            title={accessError ? "No active staff access" : "Workspace unavailable"}
          />
        </main>
      ) : null}
      {visibleState.status === "ready" ? (
        <Outlet context={{ accessToken: session.accessToken, staffContext: visibleState.context } satisfies StaffOutletContext} />
      ) : null}
    </div>
  );
}
