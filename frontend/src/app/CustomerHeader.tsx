import { CircleUserRound, LogIn, ShoppingBag, UserPlus, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { Button } from "../components/ui/button";
import { useAuth } from "../features/auth/useAuth";
import { useOptionalCartItemCount } from "../features/cart/CartContext";

export function CustomerHeader({ itemCount: providedItemCount }: { itemCount?: number } = {}) {
  const contextItemCount = useOptionalCartItemCount();
  const itemCount = providedItemCount ?? contextItemCount;
  const { isLoading, session } = useAuth();
  const { pathname } = useLocation();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const cartLabel = itemCount === 0
    ? "Current order, empty"
    : `Current order, ${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  const accountLabel = isLoading
    ? "Account menu"
    : session === null
      ? "Guest account menu"
      : `Account menu for ${session.email}`;

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAccountMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isAccountMenuOpen]);

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
        <div className="relative" ref={accountMenuRef}>
          <Button
            aria-controls="customer-account-menu"
            aria-expanded={isAccountMenuOpen}
            aria-label={accountLabel}
            className="size-11 rounded-full"
            disabled={isLoading}
            onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
            size="icon-lg"
            title="Account"
            variant="outline"
          >
            <CircleUserRound aria-hidden="true" className="size-5" />
          </Button>
          {isAccountMenuOpen ? (
            <div className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md" id="customer-account-menu">
            {session === null ? (
              <>
                <div className="grid gap-1 px-2 py-2">
                  <span>Guest</span>
                  <span className="text-xs font-normal text-muted-foreground">Sign in to view your orders and reorder favorites.</span>
                </div>
                <div className="-mx-1 my-1 h-px bg-border" />
                <Link className="flex min-h-11 items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent focus:bg-accent" onClick={() => setIsAccountMenuOpen(false)} to="/account/access?mode=sign-in"><LogIn aria-hidden="true" className="size-4" /> Sign in</Link>
                <Link className="flex min-h-11 items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent focus:bg-accent" onClick={() => setIsAccountMenuOpen(false)} to="/account/access?mode=create"><UserPlus aria-hidden="true" className="size-4" /> Create account</Link>
              </>
            ) : (
              <>
                <div className="grid gap-1 px-2 py-2">
                  <span>Signed in</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{session.email}</span>
                </div>
                <div className="-mx-1 my-1 h-px bg-border" />
                <Link className="flex min-h-11 items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent focus:bg-accent" onClick={() => setIsAccountMenuOpen(false)} to="/account"><UserRound aria-hidden="true" className="size-4" /> View account</Link>
              </>
            )}
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
