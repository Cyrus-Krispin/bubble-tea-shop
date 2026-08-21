import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router";

import { StaffSignInPage } from "../features/auth/StaffSignInPage";
import { AuthProvider } from "../features/auth/AuthProvider";
import { CustomerAccountPage } from "../features/auth/CustomerAccountPage";
import { CustomerRegistrationPage } from "../features/auth/CustomerRegistrationPage";
import { CustomerSignInPage } from "../features/auth/CustomerSignInPage";
import { CartPage } from "../features/cart/CartPage";
import { CartProvider } from "../features/cart/CartProvider";
import { DrinkPage } from "../features/catalog/DrinkPage";
import { ShopPage } from "../features/catalog/ShopPage";
import { StaffWorkspacePage } from "../features/staff/StaffWorkspacePage";
import { StaffLayout } from "../features/staff/StaffLayout";

const IngredientManagementPage = lazy(() => import("../features/staff/IngredientManagementPage"));
const RecipeManagementPage = lazy(() => import("../features/staff/RecipeManagementPage"));
const RecipeDetailPage = lazy(() => import("../features/staff/RecipeDetailPage"));
const MenuManagementPage = lazy(() => import("../features/staff/MenuManagementPage"));
const OptionManagementPage = lazy(() => import("../features/staff/OptionManagementPage"));
const OptionGroupDetailPage = lazy(() => import("../features/staff/OptionGroupDetailPage"));
const MenuProductDetailPage = lazy(() => import("../features/staff/MenuProductDetailPage"));
const InventoryManagementPage = lazy(() => import("../features/staff/InventoryManagementPage"));
const OrderOperationsPage = lazy(() => import("../features/staff/OrderOperationsPage"));
const AuditPage = lazy(() => import("../features/staff/AuditPage"));

function CatalogLoading({ label }: { label: string }) {
  return (
    <main aria-label={label} className="staff-status">
      <p role="status">Loading staff tools…</p>
    </main>
  );
}

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
          <p className="access-help">Want to save your journey? <Link to="/account/create">Create an account</Link> or <Link to="/account/sign-in">sign in</Link>.</p>
          <p className="access-help">Working today? <Link to="/staff/sign-in">Staff sign in</Link></p>
        </section>
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/drinks/:drinkId" element={<DrinkPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/account" element={<CustomerAccountPage />} />
          <Route path="/account/create" element={<CustomerRegistrationPage />} />
          <Route path="/account/sign-in" element={<CustomerSignInPage />} />
          <Route path="/staff/sign-in" element={<StaffSignInPage />} />
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<StaffWorkspacePage />} />
            <Route path="catalog" element={<Navigate replace to="/staff/catalog/ingredients" />} />
            <Route path="catalog/ingredients" element={(
              <Suspense fallback={<CatalogLoading label="Ingredient management" />}>
                <IngredientManagementPage />
              </Suspense>
            )} />
            <Route path="catalog/recipes" element={(
              <Suspense fallback={<CatalogLoading label="Recipe management" />}>
                <RecipeManagementPage />
              </Suspense>
            )} />
            <Route path="catalog/recipes/:recipeId" element={(
              <Suspense fallback={<CatalogLoading label="Recipe detail" />}>
                <RecipeDetailPage />
              </Suspense>
            )} />
            <Route path="catalog/menu" element={(
              <Suspense fallback={<CatalogLoading label="Menu management" />}>
                <MenuManagementPage />
              </Suspense>
            )} />
            <Route path="catalog/menu/:productId" element={(
              <Suspense fallback={<CatalogLoading label="Menu product detail" />}>
                <MenuProductDetailPage />
              </Suspense>
            )} />
            <Route path="catalog/options" element={(
              <Suspense fallback={<CatalogLoading label="Option management" />}>
                <OptionManagementPage />
              </Suspense>
            )} />
            <Route path="catalog/options/:groupId" element={(
              <Suspense fallback={<CatalogLoading label="Option group detail" />}>
                <OptionGroupDetailPage />
              </Suspense>
            )} />
            <Route path="inventory" element={(
              <Suspense fallback={<CatalogLoading label="Inventory management" />}>
                <InventoryManagementPage />
              </Suspense>
            )} />
            <Route path="orders" element={(
              <Suspense fallback={<CatalogLoading label="Order operations" />}>
                <OrderOperationsPage />
              </Suspense>
            )} />
            <Route path="audit" element={(
              <Suspense fallback={<CatalogLoading label="Audit timeline" />}>
                <AuditPage />
              </Suspense>
            )} />
          </Route>
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </CartProvider>
    </AuthProvider>
  );
}
