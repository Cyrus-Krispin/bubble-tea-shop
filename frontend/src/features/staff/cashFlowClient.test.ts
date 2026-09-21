import { afterEach, expect, it, vi } from "vitest";
import { expenseMinorUnits, recordExpense, getCashFlow } from "./cashFlowClient";
afterEach(() => vi.unstubAllGlobals());
it.each([["12.34", 1234], ["0.01", 1], ["1000000.00", 100000000], ["0", null], ["1.001", null], ["1e3", null], ["1000000.01", null], ["-1", null]])("parses exact paid amounts %s", (text, expected) => {
  expect(expenseMinorUnits(String(text))).toBe(expected);
});
it("uses the scoped authenticated endpoint and request key", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "expense", currencyCode: "SGD", amountMinor: 1234,
    description: "Tea", paidAt: "2026-09-15T00:00:00Z", voided: false, replayed: false }), { status: 201, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  await recordExpense("token", "org", "loc", "same-key", 1234, "Tea");
  const request = fetchMock.mock.calls[0][0] as Request;
  expect(request.headers.get("Authorization")).toBe("Bearer token");
  expect(request.headers.get("Idempotency-Key")).toBe("same-key");
  expect(request.url).toContain("/organizations/org/locations/loc/cash-flow/expenses");
  expect(await request.json()).toEqual({ amountMinor: 1234, description: "Tea" });
});
it("rejects unsafe totals rather than showing rounded financial values", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ totalPages: 1, asOf: "2026-09-15T00:00:00Z",
    totals: [{ currencyCode: "SGD", incomeMinor: Number.MAX_SAFE_INTEGER + 1, outflowMinor: 0, netMinor: 0 }], daily: [], expenses: [] }), { headers: { "Content-Type": "application/json" } })));
  await expect(getCashFlow("token", "org", "loc", 7, 0)).rejects.toThrow("Invalid cash flow total");
});
