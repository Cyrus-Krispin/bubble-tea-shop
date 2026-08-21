import { Link, Navigate, useNavigate } from "react-router";

import { LoginForm } from "./LoginForm";
import { signInCustomer } from "./authClient";
import type { Credentials } from "./types";
import { useAuth } from "./useAuth";

export function CustomerSignInPage() {
  const navigate = useNavigate();
  const { isLoading, session } = useAuth();

  if (!isLoading && session !== null) {
    return <Navigate replace to="/account" />;
  }

  async function handleSignIn(credentials: Credentials) {
    await signInCustomer(credentials);
    navigate("/account");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#customer-sign-in">Skip to sign in</a>
      <header className="app-header">
        <Link className="brand" to="/shop" aria-label="Bubble Tea Shop menu">
          <span className="brand-mark" aria-hidden="true">BT</span>
          <span><strong>Bubble Tea Shop</strong><span>Customer account</span></span>
        </Link>
      </header>
      <main aria-label="Customer sign in" className="auth-page">
        <section className="auth-introduction">
          <p className="eyebrow">Welcome back</p>
          <h1>Your tea, remembered</h1>
          <p className="lede">Sign in to continue with your customer account.</p>
          <Link to="/shop">Continue as guest</Link>
        </section>
        <section className="auth-card" id="customer-sign-in" aria-labelledby="customer-sign-in-heading">
          <p className="card-kicker">Customer account</p>
          <h2 id="customer-sign-in-heading">Sign in</h2>
          <LoginForm onSignIn={handleSignIn} />
          <p className="access-help">New here? <Link to="/account/create">Create an account</Link></p>
        </section>
      </main>
    </div>
  );
}
