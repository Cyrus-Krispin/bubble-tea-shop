import type { components } from "../../api/generated";
import { parsePlacedOrder, type CreateGuestOrderInput } from "./orderClient";

export type CardStatus = components["schemas"]["CardCheckoutStatus"];
import { CardPaymentError } from "./cardErrors";
export { CardPaymentError } from "./cardErrors";
export function parseCardStatus(value: unknown): CardStatus {
  if (!value || typeof value !== "object") throw new Error("Invalid card checkout response");
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.state !== "string" || !["CREATING", "OPEN", "PAID", "EXPIRED", "REFUND_PENDING", "REFUNDED", "FAILED", "REVIEW_REQUIRED"].includes(record.state)
    || typeof record.expiresAt !== "string" || !Number.isFinite(Date.parse(record.expiresAt)) || typeof record.cancellationRequested !== "boolean"
    || (record.recoveryCode !== null && typeof record.recoveryCode !== "string") || !Number.isSafeInteger(record.refundedMinor) || Number(record.refundedMinor) < 0) throw new Error("Invalid card checkout response");
  if (record.checkoutUrl !== null) {
    if (typeof record.checkoutUrl !== "string") throw new Error("Invalid payment URL");
    const url = new URL(record.checkoutUrl);
    if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("Invalid payment URL");
  }
  return { id: record.id, state: record.state, checkoutUrl: record.checkoutUrl as string | null,
    expiresAt: record.expiresAt, cancellationRequested: record.cancellationRequested, recoveryCode: record.recoveryCode as string | null,
    refundedMinor: Number(record.refundedMinor), order: parsePlacedOrder(record.order, "CARD") };
}
async function request(path: string, method: string, token?: string, body?: unknown, key?: string) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(key ? { "Idempotency-Key": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const data = await response.json();
  if (!response.ok) throw new CardPaymentError(typeof data?.code === "string" ? data.code : "CARD_UNAVAILABLE", response.status);
  return data as unknown;
}
export async function getPaymentMethods(signal?: AbortSignal): Promise<{ cash: boolean; card: boolean }> {
  const response = await fetch("/api/v1/guest/payment-methods", { signal });
  if (!response.ok) throw new Error("Payment methods unavailable");
  const data = await response.json();
  if (typeof data?.cash !== "boolean" || typeof data?.card !== "boolean") throw new Error("Payment methods unavailable");
  return { cash: data.cash, card: data.card };
}
export async function createCardCheckout(slug: string, key: string, input: CreateGuestOrderInput, token?: string) {
  return parseCardStatus(await request(`/api/v1/guest/locations/${encodeURIComponent(slug)}/card-checkouts`, "POST", token, input, key));
}
export async function cardCheckout(id: string, action?: "refresh" | "cancel") {
  return parseCardStatus(await request(`/api/v1/guest/card-checkouts/${encodeURIComponent(id)}${action ? `/${action}` : ""}`, action ? "POST" : "GET"));
}
export async function staffCardPayment(token: string, org: string, location: string, order: string, action: "refresh" | "cancel") {
  return parseCardStatus(await request(`/api/v1/staff/organizations/${encodeURIComponent(org)}/locations/${encodeURIComponent(location)}/orders/${encodeURIComponent(order)}/card-payment/${action}`, "POST", token));
}
