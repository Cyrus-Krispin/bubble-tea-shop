import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { LoginForm } from "./LoginForm";
import { signInWithEmailAndPassword } from "./authClient";
import type { Credentials } from "./types";
import { resolveReturnPath } from "./returnPath";
import { useAuth } from "./useAuth";

export function StaffSignInPage() {
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const { isLoading, session } = useAuth();
  const next = resolveReturnPath(searchParameters.get("next"), "/staff");

  if (!isLoading && session !== null) {
    return <Navigate replace to={next} />;
  }

  async function handleSignIn(credentials: Credentials) {
    await signInWithEmailAndPassword(credentials);
    navigate(next, { replace: true });
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#staff-sign-in">Skip to sign in</a>
      <header className="flex min-h-18 items-center border-b bg-background px-4 sm:px-8">
        <Link className="flex items-center gap-3 text-foreground no-underline" to="/" aria-label="Bubble Tea Shop home">
          <img alt="" aria-hidden="true" className="brand-icon size-10" height="40" src="/app-icon-192.png" width="40" />
          <span><strong className="block">Bubble Tea Shop</strong><span className="block text-xs text-muted-foreground">Operations</span></span>
        </Link>
      </header>
      <main aria-label="Staff sign in" className="grid min-h-[calc(100vh-4.5rem)] place-items-center px-4 py-10">
        <Card className="w-full max-w-lg" id="staff-sign-in" aria-labelledby="sign-in-heading">
          <CardHeader><p className="text-xs font-semibold tracking-widest text-primary uppercase">Bubble Tea Shop operations</p><CardTitle><h1 className="text-3xl" id="sign-in-heading">Staff sign in</h1></CardTitle><CardDescription className="text-base">Use the account assigned to your shop role.</CardDescription></CardHeader>
          <CardContent className="grid gap-6"><LoginForm onSignIn={handleSignIn} />
            <p className="text-sm text-muted-foreground">Need access? Ask the shop owner to add your staff membership.</p>
            <Button asChild variant="link"><Link to="/">Return to customer menu</Link></Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
