import { useState, type FormEvent } from "react";

import { Field } from "../../components/shared";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import type { RegistrationResult } from "./authClient";
import type { Credentials } from "./types";

type RegistrationFormProps = {
  onRegister: (credentials: Credentials) => Promise<RegistrationResult>;
};

export function RegistrationForm({ onRegister }: RegistrationFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
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
    <form className="grid gap-5" onSubmit={handleSubmit}>
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
          type={showPasswords ? "text" : "password"}
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
          type={showPasswords ? "text" : "password"}
          value={confirmation}
        />
      </Field>

      <Button className="w-fit" onClick={() => setShowPasswords((value) => !value)} size="compact" type="button" variant="ghost">
        {showPasswords ? "Hide passwords" : "Show passwords"}
      </Button>

      {message === "error" ? (
        <Alert variant="destructive"><AlertDescription>We couldn&apos;t create your account. Please try again or sign in.</AlertDescription></Alert>
      ) : null}
      {message === "ready" ? <Alert role="status"><AlertDescription>Your account is ready.</AlertDescription></Alert> : null}
      {message === "verify" ? (
        <Alert role="status"><AlertDescription>Check your email to finish creating your account.</AlertDescription></Alert>
      ) : null}

      <Button
        className="w-full"
        isLoading={isSubmitting}
        loadingLabel="Creating account"
        type="submit"
      >
        Create account
      </Button>
    </form>
  );
}
