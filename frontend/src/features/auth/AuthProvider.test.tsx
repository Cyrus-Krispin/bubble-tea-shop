import { act, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./authClient", () => ({
  getCurrentAuthSession: vi.fn(),
  subscribeToAuthState: vi.fn().mockReturnValue(() => undefined),
}));

import { AuthContext } from "./AuthContext";
import { AuthProvider } from "./AuthProvider";
import type { AuthSession } from "./types";
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
    let authListener: ((session: { accessToken: string; expiresAt: number; email: string } | null) => void) | undefined;
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
      authListener?.({ accessToken: "fresh-token", expiresAt: 4102444800, email: "customer@example.test" });
    });
    expect(screen.getByText("Signed in as customer@example.test")).toBeVisible();

    await act(async () => {
      resolveInitialSession?.(null);
    });
    expect(screen.getByText("Signed in as customer@example.test")).toBeVisible();
  });
});

function setupSession(expiresAt: number) {
  let emit: (session: AuthSession | null) => void = () => undefined;
  vi.mocked(getCurrentAuthSession).mockResolvedValue({ accessToken: "first", email: "test@example.test", expiresAt });
  vi.mocked(subscribeToAuthState).mockImplementation((listener) => { emit = listener; return () => undefined; });
  render(<AuthProvider><AuthStateProbe /></AuthProvider>);
  return (expires: number) => emit({ accessToken: "renewed", email: "test@example.test", expiresAt: expires });
}

it("clears the private session at expiry even when the issuer is unavailable", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-15T00:00:00Z"));
  setupSession(Date.now() / 1000 + 2);
  await act(async () => {});
  expect(screen.getByText("Signed in as test@example.test")).toBeVisible();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByText("Signed out")).toBeVisible();
  vi.useRealTimers();
});

it("keeps a refreshed session after the old deadline and expires at the new one", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-15T00:00:00Z"));
  const emit = setupSession(Date.now() / 1000 + 2);
  await act(async () => {});
  await act(async () => { emit(Date.now() / 1000 + 5); await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByText("Signed in as test@example.test")).toBeVisible();
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(screen.getByText("Signed out")).toBeVisible();
  vi.useRealTimers();
});

it("clears an expired session on focus after timers were suspended", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-15T00:00:00Z"));
  setupSession(Date.now() / 1000 + 2);
  await act(async () => {});
  await act(async () => { vi.setSystemTime(Date.now() + 3000); window.dispatchEvent(new Event("focus")); });
  expect(screen.getByText("Signed out")).toBeVisible();
  vi.useRealTimers();
});

it.each([0, NaN, Infinity])("rejects an invalid or expired session timestamp %s", async (expiresAt) => {
  setupSession(expiresAt);
  await act(async () => {});
  expect(screen.getByText("Signed out")).toBeVisible();
});
