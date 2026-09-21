import type { components } from "../../api/generated";
export type OwnerShopLocation = components["schemas"]["OwnerShopLocation"];
export type CurrencyPriceSet = components["schemas"]["VariantCurrencyPriceSet"];
export type NewLocation = { name: string; slug: string; currencyCode: string; timezone: string; defaultLocale: string };
async function request(token: string, path: string, body?: unknown, method = "GET", signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api/v1/staff/organizations/${path}`, { method, signal: signal ?? AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new Error(response.status === 409 ? "The record changed or already exists. Reload before trying again." : "The request could not be completed. Check your access and try again.");
  return response.json();
}
function shop(data: unknown): OwnerShopLocation {
  const value = data as OwnerShopLocation;
  if (!value || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.currencyCode !== "string" || typeof value.timezone !== "string" || typeof value.defaultLocale !== "string" || typeof value.active !== "boolean" || (value.slug !== null && typeof value.slug !== "string")) throw new Error("Invalid shop response");
  return value;
}
export async function getOwnerLocations(token: string, org: string, signal?: AbortSignal) {
  const data = await request(token, `${org}/locations`, undefined, "GET", signal);
  if (!Array.isArray(data)) throw new Error("Invalid shops response");
  return data.map(shop);
}
export async function createOwnerLocation(token: string, org: string, input: NewLocation) { return shop(await request(token, `${org}/locations`, input, "POST")); }
function prices(data: unknown): CurrencyPriceSet {
  const value = data as CurrencyPriceSet;
  if (!value || typeof value.variantId !== "string" || !["SGD", "MYR", "CNY"].includes(value.currencyCode) || !Number.isSafeInteger(value.version) || value.version < 0 || !Array.isArray(value.choices)
    || value.choices.some((choice) => !choice || typeof choice.linkId !== "string" || typeof choice.choiceName !== "string" || typeof choice.groupName !== "string" || (choice.priceDeltaMinor !== null && !Number.isSafeInteger(choice.priceDeltaMinor)))) throw new Error("Invalid currency prices");
  return value;
}
export async function getCurrencyPrices(token: string, org: string, variant: string, currency: string, signal?: AbortSignal) { return prices(await request(token, `${org}/variants/${variant}/currency-prices/${currency}`, undefined, "GET", signal)); }
export async function saveCurrencyPrices(token: string, org: string, data: CurrencyPriceSet, values: Record<string, string>) {
  const choices = data.choices.map((choice) => {
    const value = values[choice.linkId];
    if (!/^-?\d+(\.\d{1,2})?$/.test(value ?? "")) throw new Error("Enter a price with at most two decimal places for every choice, including zero.");
    const amount = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(amount) || Math.abs(amount) > 100_000_000) throw new Error("Price is outside the supported range.");
    return { linkId: choice.linkId, priceDeltaMinor: amount };
  });
  return prices(await request(token, `${org}/variants/${data.variantId}/currency-prices/${data.currencyCode}`, { version: data.version, prices: choices }, "PUT"));
}
