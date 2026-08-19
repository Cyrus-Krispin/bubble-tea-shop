import { Link, NavLink } from "react-router";
import "./CustomerHeader.css";

export function CustomerHeader({ itemCount = 0 }: { itemCount?: number }) {
  const itemLabel = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;

  return (
    <header className="customer-header">
      <Link className="customer-brand" to="/shop" aria-label="Bubble Tea Shop menu">
        <span className="leaf-mark" aria-hidden="true">✦</span>
        <span><strong>Bubble Tea Shop</strong><small>Guest ordering</small></span>
      </Link>
      <nav aria-label="Customer navigation">
        <NavLink to="/shop">Menu</NavLink>
        <span aria-disabled="true" className="nav-disabled">Track order</span>
        <Link className="order-link" to="/cart">Order <span aria-label={itemLabel}>{itemCount}</span></Link>
      </nav>
    </header>
  );
}
