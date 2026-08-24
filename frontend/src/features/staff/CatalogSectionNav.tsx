import { NavLink, useSearchParams } from "react-router";

const sections = [
  ["Ingredients", "/staff/catalog/ingredients"],
  ["Recipes", "/staff/catalog/recipes"],
  ["Menu", "/staff/catalog/menu"],
  ["Options", "/staff/catalog/options"],
] as const;

export function CatalogSectionNav() {
  const [searchParameters] = useSearchParams();
  const organizationId = searchParameters.get("organizationId");

  return (
    <nav aria-label="Catalog sections" className="catalog-section-nav">
      {sections.map(([label, path]) => (
        <NavLink
          key={path}
          to={organizationId === null ? path : `${path}?organizationId=${encodeURIComponent(organizationId)}`}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
