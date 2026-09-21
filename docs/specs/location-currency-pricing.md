# Location currencies and explicit option pricing

Owners can create an active shop in SGD, MYR or CNY with its own name, public slug, timezone and
English/Malay/Simplified Chinese default locale. Currency is immutable after creation; an existing
shop's orders, payments and inventory costs must never be relabelled. There is no exchange-rate
conversion. Existing location-specific offering prices remain the base drink prices.

The existing variant option delta remains the SGD price. MYR/CNY prices are configured explicitly
for each enabled variant choice, including zero-price choices. A shop offering is unavailable until
all enabled active choices have a price in its currency. Catalog previews, server checkout, favorite
discounts and payment amounts resolve the same currency-specific prices. Historical orders retain
their snapshots after future price edits. Staff can configure prices only within an authorized
organization; owner-only location creation does not grant a manager new assignments.

The pricing editor replaces the complete choice-price set for one variant/currency and uses the
variant version to reject concurrent edits. An empty/new location has no implicit menu or stock;
use the existing offering and manual inventory interfaces to prepare it before accepting orders.

Verify all three currencies, differing option deltas, missing-price availability, no FX fallback,
server totals and historical replay, owner authorization, unique slugs, invalid configuration,
optimistic concurrency, and currency immutability. Update schema docs and generated API/types;
run backend/frontend checks and browser verification.
