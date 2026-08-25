import { useState } from "react";
import { Link } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { Button } from "../../components/ui/button";
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
      <main aria-labelledby="account-title" className="account-page">
        <p className="eyebrow">Customer account</p>
        <h1 id="account-title">Your account</h1>

        {isLoading ? <p role="status">Loading your account…</p> : null}
        {!isLoading && session === null ? (
          <section className="account-panel" aria-labelledby="signed-out-heading">
            <h2 id="signed-out-heading">Sign in to continue</h2>
            <p>Your menu and guest ordering remain available without an account.</p>
            <div className="account-actions">
              <Link className="primary-link" to="/account/access?mode=sign-in">Sign in</Link>
              <Link to="/account/access?mode=create">Create an account</Link>
            </div>
          </section>
        ) : null}
        {!isLoading && session !== null ? (
          <>
            <section className="account-panel account-summary" aria-labelledby="details-heading">
              <div>
                <p className="card-kicker">Signed in as</p>
                <h2 id="details-heading">{session.email}</h2>
              </div>
              <Button onClick={handleSignOut} variant="secondary">Sign out</Button>
              {signOutFailed ? <p className="form-message form-message--error" role="alert">We couldn&apos;t sign you out. Please try again.</p> : null}
            </section>
            <CustomerOrderHistory accessToken={session.accessToken} />
          </>
        ) : null}
      </main>
    </div>
  );
}
