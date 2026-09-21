import { Link, useLocation } from "react-router";
import { useCart } from "./CartContext";
export function CardRecoveryNotice() {
  const { checkoutState } = useCart();
  const { pathname } = useLocation();
  const attempt = checkoutState.attempt;
  if (attempt?.method !== "CARD" || pathname.startsWith("/card-checkout/") || pathname === "/cart") return null;
  return <aside className="border-b bg-muted px-4 py-3 text-center" aria-label="Card checkout recovery">
    A card checkout still needs confirmation. <Link className="underline" to={attempt.cardId ? `/card-checkout/${attempt.cardId}` : "/cart"}>Recover card payment</Link>
  </aside>;
}
