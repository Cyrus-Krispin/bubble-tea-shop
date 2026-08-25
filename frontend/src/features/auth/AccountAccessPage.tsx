import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { CustomerHeader } from "../../app/CustomerHeader";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
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
    <div className="customer-shell">
      <a className="skip-link" href="#access-title">Skip to account access</a>
      <CustomerHeader itemCount={itemCount} />
      <main aria-label="Customer access" className="grid min-h-[calc(100vh-4.5rem)] place-items-center px-4 py-10">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Customer account</p>
            <CardTitle><h1 className="text-3xl" id="access-title">{mode === "create" ? "Create your account" : "Welcome back"}</h1></CardTitle>
            <CardDescription className="text-base leading-6">{mode === "create"
              ? "Create an optional account to keep receipts and order again. Guest checkout stays available."
              : "Sign in to see receipts and order again. Guest checkout stays available."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
          <nav aria-label="Account access options" className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <Button asChild variant={mode === "sign-in" ? "secondary" : "ghost"}><Link aria-current={mode === "sign-in" ? "page" : undefined} to={accessHref("sign-in", next)}>Sign in</Link></Button>
            <Button asChild variant={mode === "create" ? "secondary" : "ghost"}><Link aria-current={mode === "create" ? "page" : undefined} to={accessHref("create", next)}>Create account</Link></Button>
          </nav>
          {mode === "create"
            ? <RegistrationForm onRegister={handleRegistration} />
            : <LoginForm onSignIn={handleSignIn} />}
          <Button asChild variant="link"><Link to="/">Continue to menu</Link></Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
