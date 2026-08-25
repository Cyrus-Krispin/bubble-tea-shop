import { useState, type FormEvent } from "react";

import { Field } from "../../components/shared";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import type { Credentials } from "./types";

export type { Credentials } from "./types";

type LoginFormProps = {
  onSignIn: (credentials: Credentials) => Promise<void>;
};

export function LoginForm({ onSignIn }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");

    try {
      await onSignIn({ email: email.trim(), password });
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <Field id="email" label="Email address">
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </Field>

      <Field id="password" label="Password">
        <input
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type={showPassword ? "text" : "password"}
          value={password}
        />
      </Field>
      <Button className="w-fit" onClick={() => setShowPassword((value) => !value)} size="compact" type="button" variant="ghost">
        {showPassword ? "Hide password" : "Show password"}
      </Button>

      {status === "error" ? (
        <Alert variant="destructive"><AlertDescription>We couldn't sign you in. Check your email and password and try again.</AlertDescription></Alert>
      ) : null}

      {status === "success" ? (
        <Alert role="status"><AlertDescription>You're signed in.</AlertDescription></Alert>
      ) : null}

      <Button className="w-full" isLoading={isSubmitting} loadingLabel="Signing in" type="submit">Sign in</Button>
    </form>
  );
}
