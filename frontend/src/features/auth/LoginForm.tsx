import { useState, type FormEvent } from "react";

import { Button, Field } from "../../components/ui";
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
    <form className="login-form" onSubmit={handleSubmit}>
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
      <button className="password-toggle" onClick={() => setShowPassword((value) => !value)} type="button">
        {showPassword ? "Hide password" : "Show password"}
      </button>

      {status === "error" ? (
        <p className="form-message form-message--error" role="alert">
          We couldn't sign you in. Check your email and password and try again.
        </p>
      ) : null}

      {status === "success" ? (
        <p className="form-message form-message--success" role="status">
          You're signed in.
        </p>
      ) : null}

      <Button isLoading={isSubmitting} loadingLabel="Signing in" type="submit">Sign in</Button>
    </form>
  );
}
