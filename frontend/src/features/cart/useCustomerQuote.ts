import { useEffect, useMemo, useState } from "react";
import { getCustomerOrderQuote, type OrderQuote } from "../auth/favoriteClient";
import type { CreateGuestOrderInput } from "./orderClient";
import type { CartItem } from "./cartReducer";

export function useCustomerQuote(token: string | undefined, items: readonly CartItem[]) {
  const serialized = JSON.stringify({ items: items.map((item) => ({ variantId: item.configuration.variantId,
    quantity: item.quantity, optionChoiceIds: item.configuration.selections.flatMap((selection) => selection.choiceIds) })) });
  const input = useMemo(() => JSON.parse(serialized) as CreateGuestOrderInput, [serialized]);
  const scope = items[0]?.locationSlug;
  const currency = items[0]?.currency;
  const key = JSON.stringify([token, scope, input]);
  const [state, setState] = useState<{ key: string; data?: OrderQuote; error?: boolean }>();
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!token || !scope || input.items.length === 0) return;
    const controller = new AbortController();
    getCustomerOrderQuote(token, scope, input, controller.signal).then((data) => {
      if (!controller.signal.aborted) setState(data.currencyCode === currency ? { key, data } : { key, error: true });
    }).catch(() => { if (!controller.signal.aborted) setState({ key, error: true }); });
    return () => controller.abort();
  }, [token, scope, currency, input, key, reload]);
  const current = state?.key === key ? state : undefined;
  return { quote: current?.data, error: current?.error, loading: Boolean(token && items.length && !current),
    retry: () => { setState(undefined); setReload((n) => n + 1); } };
}
