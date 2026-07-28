# Domain Glossary

| Term | Meaning |
|---|---|
| Organization | The business that owns locations, staff, catalog, and ingredients. |
| Location | A physical shop with its own timezone, currency, offerings, orders, and stock. |
| Ingredient | A stock-tracked material measured in one base unit. |
| Recipe | The stable identity and description of a preparation formula. |
| Recipe version | An immutable published set of ingredient quantities. |
| Product | Customer-facing drink identity, such as Classic Milk Tea. |
| Variant | Sellable size or form of a product, such as Medium. |
| Offering | A variant made available at a location with a price and recipe version. |
| Option group | Selection rule such as Sugar Level or Toppings. |
| Option choice | A selectable value such as 50% Sugar or Pearls. |
| Ingredient effect | Quantity added or subtracted from a variant by a choice. |
| Consumption snapshot | Final ingredient quantities saved on an order item at placement time. |
| Inventory movement | Immutable explanation for a signed stock change. |
| Inventory balance | Current materialized quantity derived transactionally from movements. |
| Pending order | Order accepted into the system but not yet consuming stock. |
| Completed order | Order whose consumption snapshot has been deducted from inventory. |

