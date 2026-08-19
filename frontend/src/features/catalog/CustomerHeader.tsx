import { Link, NavLink } from "react-router";

export function CustomerHeader({ itemCount = 0 }: { itemCount?: number }) {
  return (
    <header className="customer-header">
      <Link className="customer-brand" to="/shop" aria-label="Bubble Tea Shop menu">
        <span className="leaf-mark" aria-hidden="true">✦</span>
        <span><strong>Bubble Tea Shop</strong><small>Orchard Central</small></span>
      </Link>
      <nav aria-label="Customer navigation">
        <NavLink to="/shop">Menu</NavLink>
        <a href="#tracking-unavailable" aria-disabled="true">Track order</a>
        <Link className="order-link" to="/cart">Order <span aria-label={`${itemCount} items`}>{itemCount}</span></Link>
      </nav>
    </header>
  );
}
