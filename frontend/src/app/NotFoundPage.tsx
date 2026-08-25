import { Link } from "react-router";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useCart } from "../features/cart/CartContext";
import { CustomerHeader } from "./CustomerHeader";

export function NotFoundPage() {
  const { itemCount } = useCart();
  return (
    <div className="customer-shell">
      <CustomerHeader itemCount={itemCount} />
      <main className="mx-auto w-full max-w-2xl px-4 py-16" aria-labelledby="not-found-title">
        <Card>
          <CardHeader><p className="text-xs font-semibold tracking-widest text-primary uppercase">404</p><CardTitle><h1 className="text-3xl" id="not-found-title">Page not found</h1></CardTitle></CardHeader>
          <CardContent className="grid gap-6"><p className="text-muted-foreground">The page may have moved, or the address may be incorrect.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild><Link to="/">Return to menu</Link></Button>
              {itemCount > 0 ? <Button asChild variant="outline"><Link to="/cart">View current order</Link></Button> : null}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
