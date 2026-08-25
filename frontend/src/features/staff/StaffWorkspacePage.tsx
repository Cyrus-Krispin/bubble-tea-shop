import { Link, useOutletContext } from "react-router";

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
          <Link to="/staff/orders"><strong>Review orders</strong><span>Collect cash and complete pickups</span><b aria-hidden="true">→</b></Link>
          <Link to="/staff/inventory"><strong>Check inventory</strong><span>Review balances and movements</span><b aria-hidden="true">→</b></Link>
          <Link to="/staff/catalog/menu"><strong>Manage menu</strong><span>Update products, prices, and availability</span><b aria-hidden="true">→</b></Link>
          <Link to="/staff/audit"><strong>Review audit</strong><span>Trace recent operational changes</span><b aria-hidden="true">→</b></Link>
        </nav>
      </section>
      <div className="staff-memberships">
        {staffContext.memberships.map((membership) => (
              <section className="staff-organization" key={membership.organizationId}>
                <div className="staff-organization-heading">
                  <div>
                    <p className="card-kicker">Organization</p>
                    <h2>{membership.organizationName}</h2>
                  </div>
                  <span className="role-badge">{roleLabel(membership.role)}</span>
                </div>
                <h3>Available locations</h3>
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
              </section>
        ))}
      </div>
    </main>
  );
}
