import { createContext } from "react";

import type { AuthSession } from "./types";

export type AuthContextValue = {
  isLoading: boolean;
  session: AuthSession | null;
};

export const AuthContext = createContext<AuthContextValue>({
  isLoading: false,
  session: null,
});
