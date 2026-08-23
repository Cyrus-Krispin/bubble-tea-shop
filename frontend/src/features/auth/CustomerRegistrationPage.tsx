import { Link, Navigate } from "react-router";

import { RegistrationForm } from "./RegistrationForm";
import { signUpCustomer } from "./authClient";
import { useAuth } from "./useAuth";

export function CustomerRegistrationPage() {
  const { isLoading, session } = useAuth();
  if (!isLoading && session !== null) {
    return <Navigate replace to="/account" />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#customer-registration">Skip to account creation</a>
      <header className="app-header">
        <Link className="brand" to="/shop" aria-label="Bubble Tea Shop menu">
          <span className="brand-mark" aria-hidden="true">BT</span>
          <span><strong>Bubble Tea Shop</strong><span>Customer account</span></span>
        </Link>
      </header>
      <main aria-label="Create customer account" className="auth-page">
        <section className="auth-introduction">
          <p className="eyebrow">Always optional</p>
          <h1>Save your tea journey</h1>
          <p className="lede">
            Create an account for future order history and favorites. You can always order as a guest.
          </p>
          <Link to="/shop">Continue as guest</Link>
        </section>
        <section className="auth-card" id="customer-registration" aria-labelledby="registration-heading">
          <p className="card-kicker">Customer account</p>
          <h2 id="registration-heading">Create your account</h2>
          <p className="card-copy">Your account never grants staff or owner access.</p>
          <RegistrationForm onRegister={signUpCustomer} />
          <p className="access-help">Already registered? <Link to="/account/sign-in">Sign in</Link></p>
        </section>
      </main>
    </div>
  );
}
