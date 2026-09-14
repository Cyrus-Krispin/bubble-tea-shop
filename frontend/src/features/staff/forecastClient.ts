import createClient from "openapi-fetch";
import type { components, paths } from "../../api/generated";

export type ForecastPage = components["schemas"]["InventoryForecastPage"];
export type Forecast = components["schemas"]["InventoryForecast"];

export async function getForecasts(token: string, organizationId: string, locationId: string, page: number,
  signal?: AbortSignal): Promise<ForecastPage> {
  const client = createClient<paths>({ baseUrl: window.location.origin,
    headers: { Authorization: `Bearer ${token}` } });
  const { data } = await client.GET(
    "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/inventory/forecasts",
    { params: { path: { organizationId, locationId }, query: { page, size: 25 } }, signal },
  );
  if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.totalPages)
    || data.totalPages < 0 || !Number.isFinite(Date.parse(data.calculatedAt))) throw new Error("Invalid forecast response");
  const decimal = (value: unknown) => typeof value === "string" && /^\d+(\.\d+)?$/.test(value);
  for (const item of data.items) {
    if (typeof item.ingredientId !== "string" || typeof item.ingredientName !== "string"
      || !["GRAM", "MILLILITER", "EACH"].includes(item.baseUnit) || !decimal(item.quantity)
      || (item.dailyConsumption !== null && !decimal(item.dailyConsumption))
      || (item.daysRemaining !== null && !decimal(item.daysRemaining))
      || (item.reorderThreshold !== null && !decimal(item.reorderThreshold))
      || !Number.isInteger(item.observedDays) || item.observedDays < 0 || item.observedDays > 30
      || !["ESTIMATED", "OUT_OF_STOCK", "INSUFFICIENT_HISTORY", "NO_OBSERVED_DEMAND"].includes(item.status)) {
      throw new Error("Invalid forecast response");
    }
  }
  return { ...data, items: data.items.map((item) => ({ ...item })) };
}
