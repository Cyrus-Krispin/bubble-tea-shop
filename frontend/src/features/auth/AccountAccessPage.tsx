import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { useCart } from "../cart/CartContext";
import { LoginForm } from "./LoginForm";
import { RegistrationForm } from "./RegistrationForm";
import { signInCustomer, signUpCustomer } from "./authClient";
import { resolveReturnPath } from "./returnPath";
import type { Credentials } from "./types";
import { useAuth } from "./useAuth";

function accessHref(mode: "sign-in" | "create", next: string) {
  const parameters = new URLSearchParams({ mode });
  if (next !== "/account") parameters.set("next", next);
  return `/account/access?${parameters.toString()}`;
}

export function AccountAccessPage() {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { isLoading, session } = useAuth();
  const mode = searchParameters.get("mode") === "create" ? "create" : "sign-in";
  const next = resolveReturnPath(searchParameters.get("next"), "/account");

  if (!isLoading && session !== null) return <Navigate replace to={next} />;

  async function handleSignIn(credentials: Credentials) {
    await signInCustomer(credentials);
    navigate(next, { replace: true });
  }

  async function handleRegistration(credentials: Credentials) {
    const result = await signUpCustomer(credentials);
    if (!result.verificationRequired) navigate(next, { replace: true });
    return result;
  }

  return (
    <div className="customer-shell access-shell">
      <a className="skip-link" href="#access-title">Skip to account access</a>
      <CustomerHeader itemCount={itemCount} />
      <main aria-label="Customer access" className="access-main">
        <section className="access-panel">
          <div className="access-heading">
            <p className="eyebrow">Customer account</p>
            <h1 id="access-title">{mode === "create" ? "Create your account" : "Welcome back"}</h1>
            <p>{mode === "create"
              ? "Create an optional account. Guest ordering is always available."
              : "Sign in to your Bubble Tea Shop account."}</p>
          </div>
          <nav aria-label="Account access options" className="access-modes">
            <Link aria-current={mode === "sign-in" ? "page" : undefined} to={accessHref("sign-in", next)}>Sign in</Link>
            <Link aria-current={mode === "create" ? "page" : undefined} to={accessHref("create", next)}>Create account</Link>
          </nav>
          {mode === "create"
            ? <RegistrationForm onRegister={handleRegistration} />
            : <LoginForm onSignIn={handleSignIn} />}
          <Link className="access-continue" to="/">Continue to menu</Link>
        </section>
      </main>
    </div>
  );
}
