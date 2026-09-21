# Clear an optional single-choice customization

Guests and counter staff must be able to remove a selected or defaulted option when a group allows
zero or one selection. Show an explicit “None” radio choice in these groups; selecting it clears the
choice IDs/names and removes its price from the preview and submitted order. Required single-choice
groups do not show a clearing action. Multiple-choice groups retain their existing checkbox behavior.
Use the shared DrinkOptionGroup component in both portals.

Regression checks select a paid optional topping, clear it, verify the base total and outgoing
configuration, and ensure required groups cannot be cleared. Run frontend tests, typecheck, lint,
build and an independent focused review.
