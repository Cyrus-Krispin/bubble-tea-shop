import { Link, useOutletContext } from "react-router";
import { ArrowRight, ClipboardList, PackageSearch, ScrollText, ShoppingBag } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import type { StaffOutletContext } from "./StaffLayout";
import type { StaffRole } from "./staffClient";

function roleLabel(role: StaffRole) {
  return role === "OWNER" ? "Owner" : "Manager";
}

export function StaffWorkspacePage() {
  const { staffContext } = useOutletContext<StaffOutletContext>();

  return (
    <main aria-label="Staff workspace" className="staff-main" id="staff-workspace">
      <p className="eyebrow">Staff workspace</p>
      <h1>Operations overview</h1>
      <section aria-labelledby="start-work-title" className="staff-quick-start">
        <div className="staff-quick-start__heading">
          <h2 id="start-work-title">Start work</h2>
          <p>Go straight to the task that needs your attention.</p>
        </div>
        <nav aria-label="Common staff tasks" className="staff-quick-links">
          <Link to="/staff/orders"><ClipboardList aria-hidden="true" /><strong>Review orders</strong><span>Collect cash and complete pickups</span><ArrowRight aria-hidden="true" /></Link>
          <Link to="/staff/inventory"><PackageSearch aria-hidden="true" /><strong>Check inventory</strong><span>Review balances and movements</span><ArrowRight aria-hidden="true" /></Link>
          <Link to="/staff/catalog/menu"><ShoppingBag aria-hidden="true" /><strong>Manage menu</strong><span>Update products, prices, and availability</span><ArrowRight aria-hidden="true" /></Link>
          <Link to="/staff/audit"><ScrollText aria-hidden="true" /><strong>Review audit</strong><span>Trace recent operational changes</span><ArrowRight aria-hidden="true" /></Link>
        </nav>
      </section>
      <div className="staff-memberships">
        {staffContext.memberships.map((membership) => (
              <Card className="staff-organization" key={membership.organizationId}>
                <CardHeader className="staff-organization-heading">
                  <div>
                    <p className="card-kicker">Organization</p>
                    <CardTitle><h2>{membership.organizationName}</h2></CardTitle>
                  </div>
                  <Badge variant="secondary">{roleLabel(membership.role)}</Badge>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-3 font-medium text-foreground">Available locations</CardDescription>
                  {membership.locations.length === 0 ? (
                    <p className="staff-muted">No active locations are assigned to this membership.</p>
                  ) : (
                    <ul className="staff-location-list">
                      {membership.locations.map((location) => (
                        <li key={location.id}>
                          <strong>{location.name}</strong>
                          <span>{location.timezone} · {location.currencyCode}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
        ))}
      </div>
    </main>
  );
}
