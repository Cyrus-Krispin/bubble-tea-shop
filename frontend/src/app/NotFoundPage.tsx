import { Link } from "react-router";

import { useCart } from "../features/cart/CartContext";
import { CustomerHeader } from "./CustomerHeader";

export function NotFoundPage() {
  const { itemCount } = useCart();
  return (
    <div className="customer-shell">
      <CustomerHeader itemCount={itemCount} />
      <main className="not-found-page" aria-labelledby="not-found-title">
        <p className="eyebrow">404</p>
        <h1 id="not-found-title">Page not found</h1>
        <p>The page may have moved, or the address may be incorrect.</p>
        <div className="account-actions">
          <Link className="primary-link" to="/">Return to menu</Link>
          {itemCount > 0 ? <Link className="secondary-link" to="/cart">View current order</Link> : null}
        </div>
      </main>
    </div>
  );
}
