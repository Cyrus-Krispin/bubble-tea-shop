import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../features/auth/authClient", () => ({
  signInWithEmailAndPassword: vi.fn(),
}));

import { App } from "./App";

describe("App", () => {
  it("renders the staff sign-in workspace", () => {
    render(<App />);

    expect(screen.getByRole("main")).toHaveAccessibleName("Staff sign in");
    expect(screen.getByRole("heading", { level: 1, name: "Sign in to your workspace" })).toBeVisible();
    expect(screen.getByText("Use your staff account to access shop operations.")).toBeVisible();
  });
});
