import { useEffect, useState } from "react";
import { Link, Navigate, NavLink } from "react-router";

import { signOut } from "../auth/authClient";
import { useAuth } from "../auth/useAuth";
import {
  getStaffContext,
  StaffContextError,
  type StaffContext,
  type StaffRole,
} from "./staffClient";
import "./staff.css";

type ContextState =
  | { status: "idle" | "loading" }
  | { status: "ready"; accessToken: string; context: StaffContext }
  | { status: "error"; accessToken: string; error: unknown };

function roleLabel(role: StaffRole) {
  return role === "OWNER" ? "Owner" : "Manager";
}

export function StaffWorkspacePage() {
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
          setContextState({
            status: "ready",
            accessToken,
            context,
          });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setContextState({ status: "error", accessToken, error });
        }
      });
    return () => controller.abort();
  }, [accessToken, requestVersion]);

  if (isSessionLoading) {
    return <main aria-label="Staff workspace" className="staff-status"><p role="status">Checking your session…</p></main>;
  }
  if (session === null) {
    return <Navigate replace to="/staff/sign-in" />;
  }

  const visibleContextState = (
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

  const accessError = visibleContextState.status === "error"
    && visibleContextState.error instanceof StaffContextError
    && visibleContextState.error.status === 403;

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
          <span aria-disabled="true">Catalog</span>
          <span aria-disabled="true">Inventory</span>
          <span aria-disabled="true">Orders</span>
        </nav>
        <div className="staff-account">
          <span>{session.email}</span>
          <button className="secondary-button" onClick={handleSignOut} type="button">Sign out</button>
        </div>
      </header>

      <main aria-label="Staff workspace" className="staff-main" id="staff-workspace">
        <p className="eyebrow">Staff workspace</p>
        <h1>Operations overview</h1>
        {signOutFailed ? <p className="form-message form-message--error" role="alert">We couldn&apos;t sign you out. Please try again.</p> : null}
        {visibleContextState.status === "idle" || visibleContextState.status === "loading" ? (
          <p role="status">Loading your access…</p>
        ) : null}
        {visibleContextState.status === "error" ? (
          <section className="staff-state" aria-labelledby="staff-error-title">
            <h2 id="staff-error-title">{accessError ? "No active staff access" : "Workspace unavailable"}</h2>
            <p>{accessError
              ? "Your identity is signed in, but it does not have an active staff membership."
              : "We couldn’t load your current permissions. Try again before using staff tools."}</p>
            {accessError ? (
              <button className="secondary-button" onClick={handleSignOut} type="button">Sign out</button>
            ) : (
              <button className="secondary-button" onClick={() => {
                setContextState({ status: "loading" });
                setRequestVersion((value) => value + 1);
              }} type="button">Try again</button>
            )}
          </section>
        ) : null}
        {visibleContextState.status === "ready" ? (
          <div className="staff-memberships">
            {visibleContextState.context.memberships.map((membership) => (
              <section className="staff-organization" key={membership.organizationId}>
                <div className="staff-organization-heading">
                  <div>
                    <p className="card-kicker">Organization</p>
                    <h2>{membership.organizationName}</h2>
                  </div>
                  <span className="role-badge">{roleLabel(membership.role)}</span>
                </div>
                <h3>Available locations</h3>
                {membership.locations.length === 0 ? (
                  <p className="staff-muted">No active locations are assigned to this membership.</p>
                ) : (
                  <ul className="staff-location-list">
                    {membership.locations.map((location) => (
                      <li key={location.id}>
                        <strong>{location.name}</strong>
                        <span>{location.timezone} · {location.currencyCode}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
