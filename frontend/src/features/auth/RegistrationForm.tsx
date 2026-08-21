import { useState, type FormEvent } from "react";

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
      <div className="field-group">
        <label htmlFor="registration-email">Email address</label>
        <input
          autoComplete="email"
          id="registration-email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div className="field-group">
        <label htmlFor="registration-password">Password</label>
        <input
          autoComplete="new-password"
          id="registration-password"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <small>Use at least 8 characters.</small>
      </div>

      <div className="field-group">
        <label htmlFor="registration-confirmation">Confirm password</label>
        <input
          autoComplete="new-password"
          id="registration-confirmation"
          minLength={8}
          name="passwordConfirmation"
          onChange={(event) => setConfirmation(event.target.value)}
          required
          type="password"
          value={confirmation}
        />
      </div>

      {message === "mismatch" ? <p className="form-message form-message--error" role="alert">Passwords must match.</p> : null}
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

      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
