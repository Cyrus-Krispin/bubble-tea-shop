import { useState } from "react";
import { Link } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { CustomerOrderHistory } from "../orders/CustomerOrderHistory";
import { signOut } from "./authClient";
import { useAuth } from "./useAuth";

export function CustomerAccountPage() {
  const { isLoading, session } = useAuth();
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function handleSignOut() {
    setSignOutFailed(false);
    try {
      await signOut();
    } catch {
      setSignOutFailed(true);
    }
  }

  return (
    <div className="shop-shell">
      <CustomerHeader />
      <main aria-labelledby="account-title" className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6">
        <div><p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">Customer account</p><h1 className="text-3xl" id="account-title">Your account</h1></div>

        {isLoading ? <p className="text-muted-foreground" role="status">Loading your account…</p> : null}
        {!isLoading && session === null ? (
          <Card aria-labelledby="signed-out-heading">
            <CardHeader><CardTitle><h2 id="signed-out-heading">Sign in to continue</h2></CardTitle></CardHeader>
            <CardContent className="grid gap-5"><p className="text-muted-foreground">Your menu and guest ordering remain available without an account.</p>
              <div className="flex flex-wrap gap-3">
                <Button asChild><Link to="/account/access?mode=sign-in">Sign in</Link></Button>
                <Button asChild variant="outline"><Link to="/account/access?mode=create">Create an account</Link></Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
        {!isLoading && session !== null ? (
          <>
            <Card aria-labelledby="details-heading"><CardContent className="flex flex-wrap items-center justify-between gap-4 pt-4">
              <div><p className="mb-1 text-xs font-semibold tracking-wider text-primary uppercase">Signed in as</p><h2 className="text-lg" id="details-heading">{session.email}</h2></div>
              <Button onClick={handleSignOut} variant="outline">Sign out</Button>
              {signOutFailed ? <Alert className="basis-full" variant="destructive"><AlertDescription>We couldn&apos;t sign you out. Please try again.</AlertDescription></Alert> : null}
            </CardContent></Card>
            <CustomerOrderHistory accessToken={session.accessToken} />
          </>
        ) : null}
      </main>
    </div>
  );
}
