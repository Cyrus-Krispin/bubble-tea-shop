import { useEffect, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router";
import { Field, Dialog, Pagination, ProblemState, SelectField } from "../../components/shared";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { formatMoney } from "../catalog/formatMoney";
import type { StaffOutletContext } from "./StaffLayout";
import { CashFlowError, getCashFlow, recordExpense, voidExpense, expenseMinorUnits, type CashFlowReport, type Expense } from "./cashFlowClient";

type Scope = { organizationId: string; id: string; name: string; currencyCode: string };
type Access = { token: string; scope: Scope };

function ExpenseForm({ token, scope, onRecorded, onDraftChange }: Access & { onRecorded: () => void; onDraftChange: (value: boolean) => void }) {
  const [amount, setAmount] = useState(""); const [description, setDescription] = useState("");
  const [key, setKey] = useState<string>(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => {
    onDraftChange(amount !== "" || description !== "" || key !== undefined);
    return () => onDraftChange(false);
  }, [amount, description, key, onDraftChange]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const minor = expenseMinorUnits(amount);
    if (minor === null || busy || !description.trim()) return;
    const requestKey = key ?? crypto.randomUUID(); setKey(requestKey); setBusy(true); setMessage("");
    try {
      await recordExpense(token, scope.organizationId, scope.id, requestKey, minor, description.trim());
      setAmount(""); setDescription(""); setKey(undefined); setMessage("Expense recorded."); onRecorded();
    } catch (error) {
      if (error instanceof CashFlowError && error.status >= 400 && error.status < 500) {
        setKey(undefined); setMessage("The expense was not accepted. Check the amount and your shop access.");
      } else setMessage("The outcome is unknown. Retry this same expense to avoid recording it twice.");
    } finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle><h2>Record a paid expense</h2></CardTitle></CardHeader><CardContent>
    <form className="grid gap-4" onSubmit={submit}>
      <p className="text-sm text-muted-foreground">Record money paid now. Stock receipts alone do not record expenses.</p>
      <Field id="expense-description" label="Expense description"><input required maxLength={240} disabled={key !== undefined} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <Field id="expense-amount" label={`Amount paid (${scope.currencyCode})`} description="Up to 1,000,000.00, with at most two decimal places."><input required inputMode="decimal" disabled={key !== undefined} value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
      <Button type="submit" isLoading={busy} disabled={expenseMinorUnits(amount) === null || !description.trim()}>{key ? "Retry same expense" : "Record expense"}</Button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  </CardContent></Card>;
}

function VoidExpense({ token, scope, expense, onVoided }: Access & { expense: Expense; onVoided: () => void }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !reason.trim()) return;
    setBusy(true); setError("");
    try { await voidExpense(token, scope.organizationId, scope.id, expense.id, reason.trim()); setOpen(false); onVoided(); }
    catch { setError("The correction could not be confirmed. Retrying this expense is safe."); }
    finally { setBusy(false); }
  }
  return <Dialog title="Void mistaken expense" description="This corrects the original reporting period and keeps an audit record. It does not record a refund."
    open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}
    trigger={<Button variant="outline" size="compact" aria-label={`Void ${expense.description}`}>Void entry</Button>}>
    <form className="grid gap-4" onSubmit={submit}>
      <p>{expense.description} · {formatMoney(expense.amountMinor, expense.currencyCode)}</p>
      <Field id={`void-reason-${expense.id}`} label="Reason for correction"><input required maxLength={240} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /></Field>
      {error ? <p role="alert">{error}</p> : null}
      <Button type="submit" variant="destructive" isLoading={busy} disabled={!reason.trim()}>Confirm correction</Button>
    </form>
  </Dialog>;
}

function Report({ token, scope, onDraftChange }: Access & { onDraftChange: (value: boolean) => void }) {
  const [days, setDays] = useState(7); const [page, setPage] = useState(0); const [reload, setReload] = useState(0);
  const [state, setState] = useState<{ data?: CashFlowReport; error?: boolean }>({}); const [currency, setCurrency] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getCashFlow(token, scope.organizationId, scope.id, days, page, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      if (page > Math.max(0, data.totalPages - 1)) { setState({}); setPage(Math.max(0, data.totalPages - 1)); }
      else setState({ data });
    }).catch(() => { if (!controller.signal.aborted) setState({ error: true }); });
    return () => controller.abort();
  }, [token, scope.organizationId, scope.id, days, page, reload]);
  function refresh() { setState({}); setReload((value) => value + 1); }
  const data = state.data;
  const selected = data?.totals.find((total) => total.currencyCode === currency) ?? data?.totals.find((total) => total.currencyCode === data.currencyCode) ?? data?.totals[0];
  return <div className="grid gap-6">
    <div className="flex flex-wrap items-end gap-4"><SelectField id="cash-flow-period" label="Reporting period" value={String(days)}
      options={[{ value: "1", label: "Today" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }]}
      onValueChange={(value) => { setState({}); setDays(Number(value)); setPage(0); }} />
      <Button variant="outline" onClick={refresh}>Refresh report</Button></div>
    {state.error ? <ProblemState title="Report unavailable" message="We could not load the current cash flow." actionLabel="Try again" onRetry={refresh} />
      : !data ? <p role="status">Loading cash flow…</p> : <>
      <p className="text-sm text-muted-foreground">{data.startDate} through {new Date(data.asOf).toLocaleString(undefined, { timeZone: data.timezone })} · {data.timezone}. Separate totals for each currency.</p>
      {data.totals.length > 1 ? <SelectField id="cash-flow-currency" label="Report currency" value={selected?.currencyCode ?? ""}
        options={data.totals.map((total) => ({ value: total.currencyCode, label: total.currencyCode }))} onValueChange={setCurrency} /> : null}
      {selected ? <><div className="grid gap-4 md:grid-cols-3">{[
        ["Money collected", selected.incomeMinor], ["Recorded expenses", selected.outflowMinor], ["Net cash flow", selected.netMinor],
      ].map(([label, amount]) => <Card key={label}><CardHeader><CardTitle><h2>{label}</h2></CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{formatMoney(Number(amount), selected.currencyCode)}</p></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle><h2>Daily cash flow · {selected.currencyCode}</h2></CardTitle></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Collected</TableHead><TableHead>Spent</TableHead></TableRow></TableHeader>
          <TableBody>{data.daily.filter((day) => day.currencyCode === selected.currencyCode).map((day) => <TableRow key={day.date}>
            <TableCell>{day.date}</TableCell><TableCell>{formatMoney(day.incomeMinor, day.currencyCode)}</TableCell><TableCell>{formatMoney(day.outflowMinor, day.currencyCode)}</TableCell>
          </TableRow>)}</TableBody></Table>
      </CardContent></Card></> : null}
      <Card><CardHeader><CardTitle><h2>Expense history</h2></CardTitle></CardHeader><CardContent className="grid gap-4">
        {data.expenses.length === 0 ? <p>No expenses recorded in this period.</p> : <ul className="grid gap-4">{data.expenses.map((expense) => <li key={expense.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div><strong>{expense.description}</strong><p>{formatMoney(expense.amountMinor, expense.currencyCode)} · {new Date(expense.paidAt).toLocaleString(undefined, { timeZone: data.timezone })}</p>
            {expense.voided ? <p className="text-sm text-muted-foreground">Voided · {expense.voidReason}</p> : null}</div>
          {!expense.voided ? <VoidExpense token={token} scope={scope} expense={expense} onVoided={refresh} /> : null}
        </li>)}</ul>}
        <Pagination currentPage={page + 1} totalPages={data.totalPages} onPageChange={(value) => { setState({}); setPage(value - 1); }} />
      </CardContent></Card>
    </>}
    <ExpenseForm token={token} scope={scope} onDraftChange={onDraftChange} onRecorded={() => { setPage(0); refresh(); }} />
  </div>;
}

export default function CashFlowPage() {
  const { accessToken, staffContext } = useOutletContext<StaffOutletContext>();
  const [location, setLocation] = useState("");
  const [scopeLocked, setScopeLocked] = useState(false);
  const scopes = staffContext.memberships.flatMap((member) => member.locations.map((shop) => ({ ...shop, organizationId: member.organizationId })));
  const scope = scopes.find((shop) => shop.id === location) ?? scopes[0];
  return <main id="staff-workspace" className="staff-main grid gap-5"><h1>Cash flow</h1>
    <p className="text-muted-foreground">Collected payments minus recorded paid expenses. This is not profit; expenses must be entered to make outflow complete.</p>
    {!scope ? <p>No active shops are assigned to your account.</p> : <><SelectField id="cash-flow-shop" label="Shop" disabled={scopeLocked} value={scope.id}
      options={scopes.map((shop) => ({ value: shop.id, label: shop.name }))} onValueChange={setLocation} />
      <Report key={scope.id} token={accessToken} scope={scope} onDraftChange={setScopeLocked} /></>}
  </main>;
}
