export function formatMoney(amountMinor: number) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(amountMinor / 100);
}
