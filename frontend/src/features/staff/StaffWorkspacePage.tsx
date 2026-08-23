import { useOutletContext } from "react-router";

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
