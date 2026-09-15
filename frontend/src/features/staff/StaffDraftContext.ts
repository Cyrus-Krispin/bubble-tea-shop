import { createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";

type Drafts = Record<string, unknown>;
export const StaffDraftContext = createContext<{ drafts: Drafts; setDrafts: Dispatch<SetStateAction<Drafts>> } | null>(null);

/** Only in-memory form state. The staff boundary discards it on sign-out or account change. */
export function useStaffDraft<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const cache = useContext(StaffDraftContext);
  const [local, setLocal] = useState(initialValue);
  if (!cache) return [local, setLocal];
  const value = Object.hasOwn(cache.drafts, key) ? cache.drafts[key] as T : local;
  return [value, (next) => cache.setDrafts((drafts) => {
    const current = Object.hasOwn(drafts, key) ? drafts[key] as T : local;
    return { ...drafts, [key]: typeof next === "function" ? (next as (value: T) => T)(current) : next };
  })];
}
