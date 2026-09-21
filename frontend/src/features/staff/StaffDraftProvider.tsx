import { useState, type ReactNode } from "react";
import { useAuth } from "../auth/useAuth";
import { StaffDraftContext } from "./StaffDraftContext";
export function StaffDraftProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return <StaffDraftCache key={session?.userId ?? "signed-out"}>{children}</StaffDraftCache>;
}

function StaffDraftCache({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  return <StaffDraftContext.Provider value={{ drafts, setDrafts }}>{children}</StaffDraftContext.Provider>;
}
