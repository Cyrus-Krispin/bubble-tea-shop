import { Link, Navigate, useNavigate } from "react-router";

import { LoginForm } from "./LoginForm";
import { signInWithEmailAndPassword } from "./authClient";
import type { Credentials } from "./types";
import { useAuth } from "./useAuth";

export function StaffSignInPage() {
  const navigate = useNavigate();
  const { isLoading, session } = useAuth();

  if (!isLoading && session !== null) {
    return <Navigate replace to="/staff" />;
  }

  async function handleSignIn(credentials: Credentials) {
    await signInWithEmailAndPassword(credentials);
    navigate("/staff");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#staff-sign-in">Skip to sign in</a>
      <header className="app-header">
        <Link className="brand" to="/" aria-label="Bubble Tea Shop home">
          <span className="brand-mark" aria-hidden="true">BT</span>
          <span><strong>Bubble Tea Shop</strong><span>Operations</span></span>
        </Link>
      </header>
      <main aria-label="Staff sign in" className="auth-page">
        <section className="auth-introduction" aria-labelledby="auth-page-title">
          <p className="eyebrow">Staff workspace</p>
          <h1 id="auth-page-title">Sign in to your workspace</h1>
          <p className="lede">Use your staff account to access shop operations.</p>
          <dl className="access-notes">
            <div><dt>Secure sign-in</dt><dd>Your password is handled by the local authentication service.</dd></div>
            <div><dt>Server-verified access</dt><dd>Roles and location permissions are checked before staff tools are available.</dd></div>
          </dl>
        </section>
        <section className="auth-card" id="staff-sign-in" aria-labelledby="sign-in-heading">
          <p className="card-kicker">Staff access</p>
          <h2 id="sign-in-heading">Welcome back</h2>
          <p className="card-copy">Sign in with the email and password assigned to you.</p>
          <LoginForm onSignIn={handleSignIn} />
          <p className="access-help">Need access? Ask the shop owner to add your staff membership.</p>
        </section>
      </main>
    </div>
  );
}
