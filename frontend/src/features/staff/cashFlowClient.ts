import createClient from "openapi-fetch";
import type { components, paths } from "../../api/generated";

export type CashFlowReport = components["schemas"]["CashFlowReport"];
export type Expense = components["schemas"]["CashFlowExpense"];
const root = "/api/v1/staff/organizations/{organizationId}/locations/{locationId}/cash-flow";
export class CashFlowError extends Error {
  constructor(readonly status: number) { super("Cash flow request failed"); }
}
const client = (token: string) => createClient<paths>({ baseUrl: window.location.origin, headers: { Authorization: `Bearer ${token}` } });
export async function getCashFlow(token: string, organizationId: string, locationId: string, days: number, page: number, signal?: AbortSignal): Promise<CashFlowReport> {
  const { data, response } = await client(token).GET(root, { params: { path: { organizationId, locationId }, query: { days, page } }, signal });
  if (!data) throw new CashFlowError(response.status);
  if (!Array.isArray(data.totals) || !Array.isArray(data.daily) || !Array.isArray(data.expenses)
    || !Number.isSafeInteger(data.totalPages) || data.totalPages < 0 || !Number.isFinite(Date.parse(data.asOf))) throw new Error("Invalid cash flow response");
  for (const total of data.totals) if (!Number.isSafeInteger(total.incomeMinor) || !Number.isSafeInteger(total.outflowMinor)
    || !Number.isSafeInteger(total.netMinor) || !/^[A-Z]{3}$/.test(total.currencyCode)) throw new Error("Invalid cash flow total");
  for (const day of data.daily) if (!Number.isSafeInteger(day.incomeMinor) || !Number.isSafeInteger(day.outflowMinor)
    || day.incomeMinor < 0 || day.outflowMinor < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) throw new Error("Invalid cash flow day");
  data.expenses.forEach(validateExpense);
  return { ...data, totals: data.totals.map((item) => ({ ...item })), daily: data.daily.map((item) => ({ ...item })), expenses: data.expenses.map((item) => ({ ...item })) };
}
function validateExpense(expense: Expense) {
  if (typeof expense.id !== "string" || typeof expense.description !== "string" || typeof expense.voided !== "boolean"
    || !Number.isSafeInteger(expense.amountMinor) || expense.amountMinor <= 0 || !/^[A-Z]{3}$/.test(expense.currencyCode)
    || !Number.isFinite(Date.parse(expense.paidAt))) throw new Error("Invalid expense response");
}
export async function recordExpense(token: string, organizationId: string, locationId: string, key: string, amountMinor: number, description: string) {
  const { data, response } = await client(token).POST(`${root}/expenses`, {
    params: { path: { organizationId, locationId }, header: { "Idempotency-Key": key } }, body: { amountMinor, description },
  });
  if (!data) throw new CashFlowError(response.status);
  validateExpense(data); return data;
}
export async function voidExpense(token: string, organizationId: string, locationId: string, expenseId: string, reason: string) {
  const { data, response } = await client(token).POST(`${root}/expenses/{expenseId}/void`, {
    params: { path: { organizationId, locationId, expenseId } }, body: { reason },
  });
  if (!data) throw new CashFlowError(response.status);
  validateExpense(data); return data;
}
export function expenseMinorUnits(input: string): number | null {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(input)) return null;
  const [whole, fraction = ""] = input.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return minor > 0 && minor <= 100000000 ? minor : null;
}
