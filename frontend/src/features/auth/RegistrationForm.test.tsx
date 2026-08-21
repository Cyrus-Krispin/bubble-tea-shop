import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegistrationForm } from "./RegistrationForm";

describe("RegistrationForm", () => {
  it("creates a customer account with matching credentials", async () => {
    const register = vi.fn().mockResolvedValue({ verificationRequired: false });

    render(<RegistrationForm onRegister={register} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "  customer@example.test  " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "a-long-customer-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "a-long-customer-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        email: "customer@example.test",
        password: "a-long-customer-password",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Your account is ready.");
  });

  it("stops before registration when the passwords do not match", async () => {
    const register = vi.fn();

    render(<RegistrationForm onRegister={register} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "customer@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "a-long-customer-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "a-different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords must match.");
    expect(register).not.toHaveBeenCalled();
  });

  it("does not disclose authentication-provider errors", async () => {
    const register = vi.fn().mockRejectedValue(new Error("User already registered"));

    render(<RegistrationForm onRegister={register} />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "customer@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "a-long-customer-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "a-long-customer-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't create your account. Please try again or sign in.");
    expect(alert).not.toHaveTextContent("User already registered");
  });
});
