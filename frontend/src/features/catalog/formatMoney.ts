const sgdFormatter = new Intl.NumberFormat("en-SG", {
  style: "currency",
  currency: "SGD",
});

export function formatMoney(amountMinor: number) {
  return sgdFormatter.format(amountMinor / 100);
}
