import { ShoppingBag } from "lucide-react";
import { Link, NavLink } from "react-router";

import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { useAuth } from "../features/auth/useAuth";
import { useOptionalCartItemCount } from "../features/cart/CartContext";

export function CustomerHeader({ itemCount: providedItemCount }: { itemCount?: number } = {}) {
  const contextItemCount = useOptionalCartItemCount();
  const itemCount = providedItemCount ?? contextItemCount;
  const itemLabel = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  const { isLoading, session } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between gap-4 border-b bg-background px-4 py-3 sm:px-6 lg:px-10">
      <Link className="flex min-w-0 items-center gap-3 text-foreground no-underline" to="/" aria-label="Bubble Tea Shop menu">
        <img alt="" aria-hidden="true" className="brand-icon size-10 shrink-0 object-contain" height="40" src="/app-icon-192.png" width="40" />
        <span className="hidden min-w-0 sm:block"><strong className="block text-sm font-semibold sm:text-base">Bubble Tea Shop</strong><small className="text-xs text-muted-foreground">Fresh tea · made to order</small></span>
      </Link>
      <nav aria-label="Customer navigation" className="flex items-center gap-1">
        <NavLink className={({ isActive }) => cn("inline-flex h-11 items-center rounded-lg border border-transparent px-3 text-sm font-medium text-muted-foreground no-underline hover:bg-interactive-hover hover:text-foreground", isActive && "border-interactive-selected-border bg-interactive-selected text-interactive-selected-foreground hover:bg-interactive-selected")} end to="/">Menu</NavLink>
        <NavLink className={({ isActive }) => cn("inline-flex h-11 items-center rounded-lg border border-transparent px-3 text-sm font-medium text-muted-foreground no-underline hover:bg-interactive-hover hover:text-foreground", isActive && "border-interactive-selected-border bg-interactive-selected text-interactive-selected-foreground hover:bg-interactive-selected")} to={session === null ? "/account/access?mode=sign-in" : "/account"}>
          {session === null || isLoading ? "Sign in" : "Account"}
        </NavLink>
        <Button asChild className="ml-1">
          <Link to="/cart"><ShoppingBag aria-hidden="true" /> Order <span aria-label={itemLabel} className="grid min-w-5 place-items-center rounded-full bg-primary-foreground px-1 text-xs text-primary">{itemCount}</span></Link>
        </Button>
      </nav>
    </header>
  );
}
