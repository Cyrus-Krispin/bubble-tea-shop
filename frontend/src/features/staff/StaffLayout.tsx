import { useEffect, useState } from "react";
import { ClipboardList, LayoutDashboard, LogOut, Menu, PackageSearch, ScrollText, ShoppingBag, Users } from "lucide-react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";

import { ProblemState } from "../../components/shared/ProblemState";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../../components/ui/sheet";
import { cn } from "../../lib/utils";
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

const navigation = [
  { end: true, icon: LayoutDashboard, label: "Overview", to: "/staff" },
  { end: false, icon: ShoppingBag, label: "Catalog", to: "/staff/catalog" },
  { end: false, icon: PackageSearch, label: "Inventory", to: "/staff/inventory" },
  { end: false, icon: ClipboardList, label: "Orders", to: "/staff/orders" },
  { end: false, icon: ScrollText, label: "Audit", to: "/staff/audit" },
] as const;

const mobileNavigationClassName = "flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-3 text-foreground no-underline hover:bg-interactive-hover";
const mobileNavigationActiveClassName = "border-interactive-selected-border bg-interactive-selected text-interactive-selected-foreground shadow-[inset_3px_0_0_var(--primary)] hover:bg-interactive-selected";

function isCurrentPath(pathname: string, to: string, end = false) {
  return pathname === to || (!end && pathname.startsWith(`${to}/`));
}

export function StaffLayout() {
  const location = useLocation();
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
  if (session === null) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate replace to={`/staff/sign-in?next=${encodeURIComponent(next)}`} />;
  }

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
    <div className="staff-shell bg-background text-foreground">
      <a className="skip-link" href="#staff-workspace">Skip to workspace</a>
      <aside className="staff-header bg-sidebar text-sidebar-foreground" aria-label="Staff workspace navigation">
        <Link className="staff-brand" to="/staff" aria-label="Bubble Tea Shop staff home">
          <img alt="" aria-hidden="true" className="brand-icon" height="40" src="/app-icon-192.png" width="40" />
          <span><strong>Bubble Tea Shop</strong><small>Operations</small></span>
        </Link>
        <p className="staff-nav-label">Workspace</p>
        <nav aria-label="Staff navigation">
          {navigation.map(({ end, icon: Icon, label, to }) => (
            <NavLink end={end} key={to} to={to}><Icon aria-hidden="true" className="size-4" />{label}</NavLink>
          ))}
          {visibleState.status === "ready"
            && visibleState.context.memberships.some((membership) => membership.role === "OWNER")
            ? <NavLink to="/staff/managers"><Users aria-hidden="true" className="size-4" />Team</NavLink>
            : null}
        </nav>
        <Sheet>
          <SheetTrigger asChild><Button className="staff-mobile-menu" size="icon" variant="outline"><Menu aria-hidden="true" /><span className="sr-only">Open staff navigation</span></Button></SheetTrigger>
          <SheetContent className="w-[min(22rem,88vw)]" side="right">
            <SheetHeader>
              <SheetTitle>Staff navigation</SheetTitle>
              <SheetDescription>{session.email}</SheetDescription>
            </SheetHeader>
            <nav aria-label="Mobile staff navigation" className="grid gap-1 px-4">
              {navigation.map(({ end, icon: Icon, label, to }) => (
                <SheetClose asChild key={to}><NavLink className={cn(mobileNavigationClassName, isCurrentPath(location.pathname, to, end) && mobileNavigationActiveClassName)} end={end} to={to}><Icon aria-hidden="true" className="size-4" />{label}</NavLink></SheetClose>
              ))}
              {visibleState.status === "ready" && visibleState.context.memberships.some((membership) => membership.role === "OWNER") ? (
                <SheetClose asChild><NavLink className={cn(mobileNavigationClassName, isCurrentPath(location.pathname, "/staff/managers") && mobileNavigationActiveClassName)} to="/staff/managers"><Users aria-hidden="true" className="size-4" />Team</NavLink></SheetClose>
              ) : null}
            </nav>
            <SheetFooter>
              <SheetClose asChild><Button onClick={handleSignOut} variant="outline"><LogOut aria-hidden="true" />Sign out</Button></SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <div className="staff-account">
          <span>{session.email}</span>
          <Button onClick={handleSignOut} size="compact" variant="outline"><LogOut aria-hidden="true" />Sign out</Button>
        </div>
      </aside>

      {signOutFailed ? (
        <Alert className="staff-global-message" variant="destructive">
          <AlertDescription>We couldn&apos;t sign you out. Please try again.</AlertDescription>
        </Alert>
      ) : null}
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
