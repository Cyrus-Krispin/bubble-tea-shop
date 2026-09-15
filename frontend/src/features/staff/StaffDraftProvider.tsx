import { useState, type ReactNode } from "react";
import { StaffDraftContext } from "./StaffDraftContext";
export function StaffDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  return <StaffDraftContext.Provider value={{ drafts, setDrafts }}>{children}</StaffDraftContext.Provider>;
}
