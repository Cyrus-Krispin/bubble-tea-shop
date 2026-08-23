import { Link, NavLink } from "react-router";
import { useAuth } from "../features/auth/useAuth";
import "./CustomerHeader.css";

export function CustomerHeader({ itemCount = 0 }: { itemCount?: number }) {
  const itemLabel = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  const { isLoading, session } = useAuth();

  return (
    <header className="customer-header">
      <Link className="customer-brand" to="/" aria-label="Bubble Tea Shop menu">
        <span className="brand-monogram" aria-hidden="true">BT</span>
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
