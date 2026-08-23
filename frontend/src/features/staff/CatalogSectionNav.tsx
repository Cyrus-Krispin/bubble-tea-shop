import { NavLink } from "react-router";

const sections = [
  ["Ingredients", "/staff/catalog/ingredients"],
  ["Recipes", "/staff/catalog/recipes"],
  ["Menu", "/staff/catalog/menu"],
  ["Options", "/staff/catalog/options"],
] as const;

export function CatalogSectionNav() {
  return (
    <nav aria-label="Catalog sections" className="catalog-section-nav">
      {sections.map(([label, path]) => (
        <NavLink key={path} to={path}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
