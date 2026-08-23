import { act, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./authClient", () => ({
  getCurrentAuthSession: vi.fn(),
  subscribeToAuthState: vi.fn().mockReturnValue(() => undefined),
}));

import { AuthContext } from "./AuthContext";
import { AuthProvider } from "./AuthProvider";
import { getCurrentAuthSession, subscribeToAuthState } from "./authClient";

function AuthStateProbe() {
  const { isLoading, session } = useContext(AuthContext);
  if (isLoading) {
    return <p>Loading</p>;
  }
  return <p>{session === null ? "Signed out" : `Signed in as ${session.email}`}</p>;
}

describe("AuthProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the session pending until the authentication client responds", async () => {
    vi.useFakeTimers();
    vi.mocked(getCurrentAuthSession).mockReturnValue(new Promise(() => undefined));

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(screen.getByText("Loading")).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByText("Loading")).toBeVisible();
    expect(screen.queryByText("Signed out")).not.toBeInTheDocument();
  });

  it("does not overwrite a fresh auth event with a stale initial lookup", async () => {
    let resolveInitialSession: ((value: null) => void) | undefined;
    let authListener: ((session: { accessToken: string; email: string } | null) => void) | undefined;
    vi.mocked(getCurrentAuthSession).mockReturnValue(new Promise((resolve) => {
      resolveInitialSession = resolve;
    }));
    vi.mocked(subscribeToAuthState).mockImplementation((listener) => {
      authListener = listener;
      return () => undefined;
    });

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    await act(async () => {
      authListener?.({ accessToken: "fresh-token", email: "customer@example.test" });
    });
    expect(screen.getByText("Signed in as customer@example.test")).toBeVisible();

    await act(async () => {
      resolveInitialSession?.(null);
    });
    expect(screen.getByText("Signed in as customer@example.test")).toBeVisible();
  });
});
