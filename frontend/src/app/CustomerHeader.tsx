import { Link, NavLink } from "react-router";
import { useAuth } from "../features/auth/useAuth";
import { useOptionalCartItemCount } from "../features/cart/CartContext";
import "./CustomerHeader.css";

export function CustomerHeader({ itemCount: providedItemCount }: { itemCount?: number } = {}) {
  const contextItemCount = useOptionalCartItemCount();
  const itemCount = providedItemCount ?? contextItemCount;
  const itemLabel = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  const { isLoading, session } = useAuth();

  return (
    <header className="customer-header">
      <Link className="customer-brand" to="/" aria-label="Bubble Tea Shop menu">
        <img alt="" aria-hidden="true" className="brand-icon" height="40" src="/app-icon-192.png" width="40" />
        <span><strong>Bubble Tea Shop</strong><small>Fresh tea · made to order</small></span>
      </Link>
      <nav aria-label="Customer navigation">
        <NavLink end to="/">Menu</NavLink>
        <NavLink to={session === null ? "/account/access?mode=sign-in" : "/account"}>
          {session === null || isLoading ? "Sign in" : "Account"}
        </NavLink>
        <Link className="order-link" to="/cart">Order <span aria-label={itemLabel}>{itemCount}</span></Link>
      </nav>
    </header>
  );
}
