import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";

import { AccountAccessPage } from "../features/auth/AccountAccessPage";
import { StaffSignInPage } from "../features/auth/StaffSignInPage";
import { AuthProvider } from "../features/auth/AuthProvider";
import { CustomerAccountPage } from "../features/auth/CustomerAccountPage";
import { CartPage } from "../features/cart/CartPage";
import { CartProvider } from "../features/cart/CartProvider";
import { DrinkPage } from "../features/catalog/DrinkPage";
import { ShopPage } from "../features/catalog/ShopPage";
import { StaffWorkspacePage } from "../features/staff/StaffWorkspacePage";
import { StaffLayout } from "../features/staff/StaffLayout";
import { NotFoundPage } from "./NotFoundPage";

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
const ManagerManagementPage = lazy(() => import("../features/staff/ManagerManagementPage"));

function CatalogLoading({ label }: { label: string }) {
  return (
    <main aria-label={label} className="staff-status">
      <p role="status">Loading staff tools…</p>
    </main>
  );
}

function LegacyAccountAccessRedirect({ mode }: { mode: "create" | "sign-in" }) {
  const { search } = useLocation();
  const parameters = new URLSearchParams(search);
  parameters.set("mode", mode);
  return <Navigate replace to={`/account/access?${parameters.toString()}`} />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<ShopPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/drinks/:drinkId" element={<DrinkPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/account" element={<CustomerAccountPage />} />
          <Route path="/account/access" element={<AccountAccessPage />} />
          <Route path="/account/create" element={<LegacyAccountAccessRedirect mode="create" />} />
          <Route path="/account/sign-in" element={<LegacyAccountAccessRedirect mode="sign-in" />} />
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
            <Route path="managers" element={(
              <Suspense fallback={<CatalogLoading label="Manager access" />}>
                <ManagerManagementPage />
              </Suspense>
            )} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </CartProvider>
    </AuthProvider>
  );
}
