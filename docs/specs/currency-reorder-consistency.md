# Reorder suggestions use the shop currency

## Problem

“Order again” resolved current topping prices from legacy SGD fields even for MYR and CNY shops.
It could also offer a variant whose active choices had not all been priced in the shop currency.

## Contract

- Current reorder prices use the same currency-specific option prices as the public menu and checkout.
- No conversion or fallback to another currency. Missing prices make the suggestion unavailable.
- The complete active option price set must be ready, including options absent from the previous order.
- Read the eligibility, recipe, stock and price queries in one repeatable-read transaction.
- Historical order receipts retain their original prices and currency.

## Verification

API regressions create MYR and CNY shops with base price 1000, legacy SGD topping 60, and explicit
currency topping prices 150/250. Suggestions must total 1150/1250. Removing an unselected option's
price must return no suggestion. Original receipts must remain unchanged. Existing SGD, stock,
identity and unavailable-menu tests remain required. Run the full backend verification suite.
