import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("submits the entered email and password then confirms a successful sign-in", async () => {
    const signIn = vi.fn().mockResolvedValue(undefined);

    render(<LoginForm onSignIn={signIn} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "  manager@bubbletea.test  " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery-staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith({
        email: "manager@bubbletea.test",
        password: "correct-horse-battery-staple",
      });
    });
    expect(await screen.findByText("You're signed in.")).toBeVisible();
  });

  it("does not disclose authentication-provider details when sign-in fails", async () => {
    const signIn = vi.fn().mockRejectedValue(new Error("User does not exist"));

    render(<LoginForm onSignIn={signIn} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "manager@bubbletea.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "incorrect-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't sign you in. Check your email and password and try again.");
    expect(alert).not.toHaveTextContent("User does not exist");
  });

  it("leaves password requirements to the authentication service", () => {
    render(<LoginForm onSignIn={vi.fn()} />);

    expect(screen.getByLabelText("Password")).not.toHaveAttribute("minlength");
  });
});
