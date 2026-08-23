import { useState } from "react";
import { Link } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { Button } from "../../components/ui";
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
          <section className="account-panel" aria-labelledby="details-heading">
            <h2 id="details-heading">Account details</h2>
            <dl><div><dt>Email</dt><dd>{session.email}</dd></div></dl>
            <p className="account-note">Account-linked order history is planned for a later release.</p>
            {signOutFailed ? <p className="form-message form-message--error" role="alert">We couldn&apos;t sign you out. Please try again.</p> : null}
            <Button onClick={handleSignOut} variant="secondary">Sign out</Button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
