import type { CustomerOrderStatus } from "./customerOrderClient";

export function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function orderStatusLabel(status: CustomerOrderStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
