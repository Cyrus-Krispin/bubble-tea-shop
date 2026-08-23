import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

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
      <header className="app-header">
        <Link className="brand" to="/" aria-label="Bubble Tea Shop home">
          <img alt="" aria-hidden="true" className="brand-icon" height="40" src="/app-icon-192.png" width="40" />
          <span><strong>Bubble Tea Shop</strong><span>Operations</span></span>
        </Link>
      </header>
      <main aria-label="Staff sign in" className="auth-page staff-auth-page">
        <section className="auth-card" id="staff-sign-in" aria-labelledby="sign-in-heading">
          <p className="card-kicker">Bubble Tea Shop operations</p>
          <h1 id="sign-in-heading">Staff sign in</h1>
          <p className="card-copy">Use the account assigned to your shop role.</p>
          <LoginForm onSignIn={handleSignIn} />
          <p className="access-help">Need access? Ask the shop owner to add your staff membership.</p>
          <p className="access-help"><Link to="/">Return to customer menu</Link></p>
        </section>
      </main>
    </div>
  );
}
