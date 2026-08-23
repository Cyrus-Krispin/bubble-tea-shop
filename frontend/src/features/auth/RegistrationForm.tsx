import { useState, type FormEvent } from "react";

import { Button, Field } from "../../components/ui";
import type { RegistrationResult } from "./authClient";
import type { Credentials } from "./types";

type RegistrationFormProps = {
  onRegister: (credentials: Credentials) => Promise<RegistrationResult>;
};

export function RegistrationForm({ onRegister }: RegistrationFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<"idle" | "ready" | "verify" | "mismatch" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("idle");

    if (password !== confirmation) {
      setMessage("mismatch");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onRegister({ email: email.trim(), password });
      setMessage(result.verificationRequired ? "verify" : "ready");
    } catch {
      setMessage("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <Field id="registration-email" label="Email address">
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </Field>

      <Field
        description="Use at least 8 characters."
        id="registration-password"
        label="Password"
      >
        <input
          autoComplete="new-password"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </Field>

      <Field
        error={message === "mismatch" ? "Passwords must match." : undefined}
        id="registration-confirmation"
        label="Confirm password"
      >
        <input
          autoComplete="new-password"
          minLength={8}
          name="passwordConfirmation"
          onChange={(event) => setConfirmation(event.target.value)}
          required
          type="password"
          value={confirmation}
        />
      </Field>

      {message === "error" ? (
        <p className="form-message form-message--error" role="alert">
          We couldn&apos;t create your account. Please try again or sign in.
        </p>
      ) : null}
      {message === "ready" ? <p className="form-message form-message--success" role="status">Your account is ready.</p> : null}
      {message === "verify" ? (
        <p className="form-message form-message--success" role="status">
          Check your email to finish creating your account.
        </p>
      ) : null}

      <Button
        isLoading={isSubmitting}
        loadingLabel="Creating account"
        type="submit"
      >
        Create account
      </Button>
    </form>
  );
}
