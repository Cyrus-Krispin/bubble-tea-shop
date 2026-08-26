import { CircleUserRound, LogIn, ShoppingBag, UserPlus, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router";

import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useAuth } from "../features/auth/useAuth";
import { useOptionalCartItemCount } from "../features/cart/CartContext";

export function CustomerHeader({ itemCount: providedItemCount }: { itemCount?: number } = {}) {
  const contextItemCount = useOptionalCartItemCount();
  const itemCount = providedItemCount ?? contextItemCount;
  const { isLoading, session } = useAuth();
  const { pathname } = useLocation();
  const cartLabel = itemCount === 0
    ? "Current order, empty"
    : `Current order, ${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  const accountLabel = isLoading
    ? "Account menu"
    : session === null
      ? "Guest account menu"
      : `Account menu for ${session.email}`;

  return (
    <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between gap-4 border-b bg-background px-4 py-3 sm:px-6 lg:px-10">
      <Link className="flex min-w-0 items-center gap-3 text-foreground no-underline" to="/" aria-label="Bubble Tea Shop menu">
        <img alt="" aria-hidden="true" className="brand-icon size-10 shrink-0 object-contain" height="40" src="/app-icon-192.png" width="40" />
        <span className="hidden min-w-0 sm:block"><strong className="block text-sm font-semibold sm:text-base">Bubble Tea Shop</strong><small className="text-xs text-muted-foreground">Fresh tea · made to order</small></span>
      </Link>
      <nav aria-label="Customer navigation" className="flex items-center gap-2">
        <Button asChild className="relative size-11 rounded-full" size="icon-lg" variant={pathname === "/cart" ? "secondary" : "ghost"}>
          <Link aria-current={pathname === "/cart" ? "page" : undefined} aria-label={cartLabel} title="Current order" to="/cart">
            <ShoppingBag aria-hidden="true" className="size-5" />
            {itemCount > 0 ? (
              <span aria-hidden="true" className="absolute -top-1 -right-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.6875rem] font-semibold leading-none text-primary-foreground ring-2 ring-background" data-slot="cart-count">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            ) : null}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={accountLabel} className="size-11 rounded-full" disabled={isLoading} size="icon-lg" title="Account" variant="outline">
              <CircleUserRound aria-hidden="true" className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
            {session === null ? (
              <>
                <DropdownMenuLabel className="grid gap-1 px-2 py-2">
                  <span>Guest</span>
                  <span className="text-xs font-normal text-muted-foreground">Sign in to view your orders and reorder favorites.</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="min-h-11 px-2 py-2">
                  <Link to="/account/access?mode=sign-in"><LogIn aria-hidden="true" /> Sign in</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="min-h-11 px-2 py-2">
                  <Link to="/account/access?mode=create"><UserPlus aria-hidden="true" /> Create account</Link>
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel className="grid gap-1 px-2 py-2">
                  <span>Signed in</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{session.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="min-h-11 px-2 py-2">
                  <Link to="/account"><UserRound aria-hidden="true" /> View account</Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
}
