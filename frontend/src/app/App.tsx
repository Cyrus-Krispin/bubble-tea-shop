import { Link, Navigate, Route, Routes } from "react-router";

import { StaffSignInPage } from "../features/auth/StaffSignInPage";
import { ShopPage } from "../features/catalog/ShopPage";

function WelcomePage() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#welcome-title">Skip to welcome</a>
      <header className="app-header">
        <Link className="brand" to="/" aria-label="Bubble Tea Shop home">
          <span className="brand-mark" aria-hidden="true">BT</span>
          <span><strong>Bubble Tea Shop</strong><span>Freshly made, your way</span></span>
        </Link>
      </header>
      <main aria-labelledby="welcome-title" className="auth-page">
        <section className="auth-introduction">
          <p className="eyebrow">A little joy in every cup</p>
          <h1 id="welcome-title">Your next favorite brew starts here.</h1>
          <p className="lede">Browse the menu, make it yours, and order for pickup—no account needed.</p>
        </section>
        <section className="auth-card" aria-labelledby="order-heading">
          <p className="card-kicker">Guest ordering</p>
          <h2 id="order-heading">Ready for tea?</h2>
          <p className="card-copy">Explore today&apos;s drinks and build your order as a guest.</p>
          <Link className="primary-link" to="/shop">Continue as guest</Link>
          <p className="access-help">Working today? <Link to="/staff/sign-in">Staff sign in</Link></p>
        </section>
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/shop" element={<ShopPage />} />
      <Route path="/staff/sign-in" element={<StaffSignInPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}
