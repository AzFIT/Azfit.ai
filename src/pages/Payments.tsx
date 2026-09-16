/* ═══════════════════════════════════════════════════════════════════
   Payments (Phase 96) — trainer money page: per-client rates, paid
   session packages, the payments ledger, and derived attendance.

   MONEY: everything is integer cents (src/lib/money.ts); the revenue
   total is always SUM(payments.amount_cents) — never a derived or
   fabricated number. HONEST DATA: a client with no rate / no package
   / no payments renders those states absent, never as zeros.
   ═══════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  CreditCard,
  Package as PackageIcon,
  CircleDollarSign,
  CalendarCheck,
  Ticket,
  Receipt,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import LogoHomeButton from "@/components/LogoHomeButton";
import { formatCents, parseMoneyInput, sumCents } from "@/lib/money";
import {
  monthKeyLocal,
  monthlyRevenue,
  kpiSums,
  byKindBreakdown,
  topClientsByRevenue,
  monthExpenses,
  netProfit,
  type PaymentLike,
  type ExpenseLike,
} from "@/lib/moneyDashboard";
import { formatDateKeyLocal } from "@/lib/utils";
import { showExpiryWarning, remainingSessions } from "@/lib/sessionBilling";
import type { BookingClient } from "@/lib/bookingRoster";
import {
  loadPaymentsRoster,
  getClientBilling,
  upsertRate,
  createPackage,
  setPackageActive,
  logPayment,
  loadTrainerPayments,
  loadExpenses,
  addExpense,
  deleteExpense,
  type ClientBilling,
  type Payment,
  type Expense,
} from "@/services/payments";
import { supabase } from "@/lib/supabase";

const inputCls =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--azfit-primary)]/40";
const inputStyle = {
  backgroundColor: "var(--card-bg)",
  borderColor: "var(--card-border)",
  color: "var(--page-text)",
} as const;
const labelCls = "mb-1 block text-xs font-medium";
const labelStyle = { color: "var(--light-text-muted)" } as const;

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-4"
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <h3
        className="mb-3 flex items-center gap-2 text-sm font-semibold"
        style={{ color: "var(--page-text)" }}
      >
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function Payments() {
  const { user } = useAuth();
  const [roster, setRoster] = useState<BookingClient[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BookingClient | null>(null);
  const [billing, setBilling] = useState<ClientBilling | null>(null);
  const [attended, setAttended] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Rate form
  const [rateInput, setRateInput] = useState("");
  const [rateUnit, setRateUnit] = useState<"session" | "month">("session");
  const [savingRate, setSavingRate] = useState(false);
  // Package form
  const [pkgName, setPkgName] = useState("");
  const [pkgSessions, setPkgSessions] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgExpiry, setPkgExpiry] = useState("");
  const [savingPkg, setSavingPkg] = useState(false);
  // Payment form
  const [payAmount, setPayAmount] = useState("");
  const [payKind, setPayKind] = useState("single_session");
  const [payNote, setPayNote] = useState("");
  const [payPackageId, setPayPackageId] = useState("");
  const [savingPay, setSavingPay] = useState(false);

  // ── Phase 96b: trainer-wide overview data ──
  const [trainerPayments, setTrainerPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expLabel, setExpLabel] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(() => formatDateKeyLocal(new Date()));
  const [expRecurring, setExpRecurring] = useState(true);
  const [savingExp, setSavingExp] = useState(false);

  const reloadOverview = async () => {
    const [p, e] = await Promise.all([loadTrainerPayments(), loadExpenses()]);
    setTrainerPayments(p);
    setExpenses(e);
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const r = await loadPaymentsRoster(user.id);
      if (!cancelled) {
        setRoster(r);
        setRosterLoaded(true);
      }
    })();
    void reloadOverview();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const refresh = async (recordId: string) => {
    const b = await getClientBilling(recordId);
    setBilling(b);
    // Derived attendance: completed sessions for this client's record.
    const { count } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("client_record_id", recordId)
      .eq("status", "completed");
    setAttended(count ?? 0);
    // Prefill the rate form from the stored rate.
    if (b.rate) {
      setRateInput((b.rate.rate_cents / 100).toString());
      setRateUnit(b.rate.billing_unit === "month" ? "month" : "session");
    } else {
      setRateInput("");
      setRateUnit("session");
    }
  };

  const pickClient = async (c: BookingClient) => {
    setSelected(c);
    setLoading(true);
    setBilling(null);
    setAttended(null);
    try {
      await refresh(c.recordId);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [roster, query]);

  const revenueCents = useMemo(
    () => (billing ? sumCents(billing.payments.map((p) => p.amount_cents)) : 0),
    [billing],
  );

  const handleSaveRate = async () => {
    if (!selected) return;
    const cents = parseMoneyInput(rateInput);
    if (cents === null || cents <= 0) {
      toast.error("Enter a valid rate amount");
      return;
    }
    setSavingRate(true);
    const res = await upsertRate(selected.recordId, cents, rateUnit);
    setSavingRate(false);
    if (!res.ok) {
      toast.error(`Could not save rate: ${res.error}`);
      return;
    }
    toast.success("Rate saved");
    await refresh(selected.recordId);
  };

  const handleCreatePackage = async () => {
    if (!selected) return;
    const sessions = Number(pkgSessions);
    const priceCents = parseMoneyInput(pkgPrice);
    if (!pkgName.trim()) return toast.error("Package name is required");
    if (!Number.isInteger(sessions) || sessions <= 0) return toast.error("Sessions must be a whole number");
    if (priceCents === null) return toast.error("Enter a valid price");
    const expiresAt = pkgExpiry
      ? new Date(`${pkgExpiry}T23:59:59`).toISOString()
      : null;
    setSavingPkg(true);
    const res = await createPackage(selected.recordId, {
      name: pkgName.trim(),
      totalSessions: sessions,
      priceCents,
      expiresAt,
    });
    setSavingPkg(false);
    if (!res.ok) {
      toast.error(`Could not create package: ${res.error}`);
      return;
    }
    toast.success("Package created");
    setPkgName("");
    setPkgSessions("");
    setPkgPrice("");
    setPkgExpiry("");
    await refresh(selected.recordId);
  };

  const handleLogPayment = async () => {
    if (!selected) return;
    const cents = parseMoneyInput(payAmount);
    if (cents === null) return toast.error("Enter a valid amount");
    setSavingPay(true);
    const res = await logPayment(selected.recordId, {
      amountCents: cents,
      kind: payKind,
      packageId: payPackageId || null,
      note: payNote,
    });
    setSavingPay(false);
    if (!res.ok) {
      toast.error(`Could not log payment: ${res.error}`);
      return;
    }
    toast.success("Payment logged");
    setPayAmount("");
    setPayNote("");
    setPayPackageId("");
    await refresh(selected.recordId);
    void reloadOverview();
  };

  const handleAddExpense = async () => {
    const cents = parseMoneyInput(expAmount);
    if (!expLabel.trim()) return toast.error("Enter an expense label");
    if (cents === null) return toast.error("Enter a valid amount");
    if (!expDate) return toast.error("Pick an expense date");
    setSavingExp(true);
    const res = await addExpense({
      label: expLabel,
      amountCents: cents,
      expenseDate: expDate,
      recurring: expRecurring,
    });
    setSavingExp(false);
    if (!res.ok) {
      toast.error(`Could not add expense: ${res.error}`);
      return;
    }
    toast.success("Expense added");
    setExpLabel("");
    setExpAmount("");
    void reloadOverview();
  };

  const handleDeleteExpense = async (id: string) => {
    const res = await deleteExpense(id);
    if (!res.ok) {
      toast.error("Could not delete expense");
      return;
    }
    toast.success("Expense deleted");
    void reloadOverview();
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4">
      <header className="relative mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "var(--page-text)" }}>
          Payments
        </h1>
        <LogoHomeButton />
        <span className="w-11" aria-hidden />
      </header>

      {/* Phase 96b — Overview: real sums only, honest empty when no payments */}
      <Overview
        payments={trainerPayments}
        expenses={expenses}
        nameOf={(id) => roster.find((c) => c.recordId === id)?.name ?? "(archived client)"}
      />

      {/* Phase 96b — Expenses (trainer-owned, 96b RLS owner-only) */}
      <section
        className="mb-4 rounded-2xl border p-4"
        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
      >
        <h3
          className="mb-3 flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--page-text)" }}
        >
          <Receipt className="h-4 w-4" style={{ color: "var(--azfit-accent)" }} />
          Expenses
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={expLabel}
            onChange={(e) => setExpLabel(e.target.value)}
            placeholder="Label (e.g. Gym rent)"
            aria-label="Expense label"
            className={inputCls}
            style={inputStyle}
          />
          <input
            value={expAmount}
            onChange={(e) => setExpAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Amount (e.g. 150.00)"
            aria-label="Expense amount"
            className={inputCls}
            style={inputStyle}
          />
          <input
            type="date"
            value={expDate}
            onChange={(e) => setExpDate(e.target.value)}
            aria-label="Expense date"
            className={inputCls}
            style={inputStyle}
          />
          <label
            className="flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--page-text)" }}
          >
            <input
              type="checkbox"
              checked={expRecurring}
              onChange={(e) => setExpRecurring(e.target.checked)}
              aria-label="Recurring monthly expense"
              className="h-4 w-4"
            />
            Recurring
          </label>
        </div>
        <button
          type="button"
          onClick={() => void handleAddExpense()}
          disabled={savingExp}
          className="mt-2 h-11 rounded-lg px-4 text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--azfit-accent)" }}
        >
          {savingExp ? "Adding…" : "Add expense"}
        </button>
        {expenses.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--light-text-muted)" }}>
            No expenses yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y" style={{ borderColor: "var(--card-border)" }}>
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block text-sm" style={{ color: "var(--page-text)" }}>
                    {e.label}
                    {e.recurring && (
                      <span className="ml-2 text-xs" style={{ color: "var(--light-text-muted)" }}>
                        recurring
                      </span>
                    )}
                  </span>
                  <span className="block text-xs" style={{ color: "var(--light-text-muted)" }}>
                    {e.expense_date}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
                    {formatCents(e.amount_cents)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteExpense(e.id)}
                    aria-label={`Delete expense ${e.label}`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Client picker (Phase 90h roster pattern — includes account-less clients) */}
      <div className="mb-4">
        <div
          className="mb-2 flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: "var(--light-text-muted)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients by name or email…"
            aria-label="Search clients"
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--page-text)" }}
          />
        </div>
        {!rosterLoaded ? (
          <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
            Loading clients…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
            {roster.length === 0 ? "No clients yet." : "No clients match that search."}
          </p>
        ) : (
          <ul
            className="max-h-56 overflow-y-auto rounded-lg border"
            style={{ borderColor: "var(--card-border)" }}
          >
            {filtered.map((c) => (
              <li key={c.recordId}>
                <button
                  type="button"
                  onClick={() => void pickClient(c)}
                  className="flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-left text-sm last:border-b-0"
                  style={{
                    backgroundColor:
                      selected?.recordId === c.recordId ? "var(--light-elevated)" : "var(--card-bg)",
                    borderColor: "var(--card-border)",
                    color: "var(--page-text)",
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    {c.email && (
                      <span className="block truncate text-xs" style={{ color: "var(--light-text-muted)" }}>
                        {c.email}
                        {c.profileId === null && " · no portal account"}
                      </span>
                    )}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: "var(--light-elevated)",
                      color: "var(--light-text-muted)",
                    }}
                  >
                    {c.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <p className="mb-4 text-sm" style={{ color: "var(--light-text-muted)" }}>
          {loading ? "Loading…" : `Viewing ${selected.name}`}
          {attended !== null && !loading && (
            <span className="ml-2 inline-flex items-center gap-1">
              <CalendarCheck className="h-3.5 w-3.5" />
              {attended} session{attended === 1 ? "" : "s"} attended
            </span>
          )}
        </p>
      )}

      {selected && billing && !loading && (
        <div className="space-y-4">
          {/* Revenue — always SUM(payments), honest empty when none */}
          <div
            className="flex items-center justify-between rounded-2xl border p-4"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <span className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--light-text-muted)" }}>
              <CircleDollarSign className="h-4 w-4" />
              Total revenue (this client)
            </span>
            <strong className="text-lg" style={{ color: "var(--page-text)" }}>
              {billing.payments.length > 0 ? formatCents(revenueCents) : "—"}
            </strong>
          </div>

          {/* Rate */}
          <Section icon={<CreditCard className="h-4 w-4" style={{ color: "var(--azfit-primary)" }} />} title="Session rate">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="rate-amount" className={labelCls} style={labelStyle}>
                  Amount
                </label>
                <input
                  id="rate-amount"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 45.00"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div className="sm:w-36">
                <label htmlFor="rate-unit" className={labelCls} style={labelStyle}>
                  Billing unit
                </label>
                <select
                  id="rate-unit"
                  value={rateUnit}
                  onChange={(e) => setRateUnit(e.target.value as "session" | "month")}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="session">per session</option>
                  <option value="month">per month</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => void handleSaveRate()}
                disabled={savingRate}
                className="h-10 rounded-lg px-4 text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--azfit-primary)" }}
              >
                {savingRate ? "Saving…" : billing.rate ? "Update rate" : "Set rate"}
              </button>
            </div>
            {!billing.rate && (
              <p className="mt-2 text-xs" style={{ color: "var(--light-text-muted)" }}>
                No rate set — session auto-payments will log $0.00 until one is set.
              </p>
            )}
          </Section>

          {/* Packages */}
          <Section icon={<Ticket className="h-4 w-4" style={{ color: "var(--azfit-accent)" }} />} title="Packages">
            {billing.packages.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
                No packages yet.
              </p>
            ) : (
              <ul className="mb-3 space-y-2">
                {billing.packages.map((p) => {
                  const remaining = remainingSessions(p);
                  const expired = p.expires_at !== null && new Date(p.expires_at).getTime() <= Date.now();
                  const warn = showExpiryWarning(p, new Date());
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl border p-3"
                      style={{ borderColor: "var(--card-border)", opacity: p.active ? 1 : 0.6 }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium" style={{ color: "var(--page-text)" }}>
                          {p.name}
                          {!p.active && (
                            <span className="ml-2 text-xs" style={{ color: "var(--light-text-muted)" }}>
                              (inactive)
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void setPackageActive(p.id, !p.active).then((r) => {
                              if (r.ok) {
                                toast.success(p.active ? "Package deactivated" : "Package activated");
                                void refresh(selected.recordId);
                              } else {
                                toast.error("Could not update package");
                              }
                            })
                          }
                          className="text-xs font-medium"
                          style={{ color: "var(--azfit-primary)" }}
                        >
                          {p.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                      {expired || remaining === 0 ? (
                        <p className="mt-1 text-xs font-medium" style={{ color: "var(--danger)" }}>
                          {expired ? "Expired" : "Exhausted"} — {remaining} of {p.total_sessions} remaining
                        </p>
                      ) : (
                        <p className="mt-1 text-xs" style={{ color: "var(--light-text-muted)" }}>
                          <strong style={{ color: "var(--page-text)" }}>{remaining}</strong> of{" "}
                          {p.total_sessions} remaining
                          {warn && (
                            <span className="ml-1 font-medium" style={{ color: "var(--warning)" }}>
                              — expires soon
                            </span>
                          )}
                        </p>
                      )}
                      {/* progress bar */}
                      <div
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                        style={{ backgroundColor: "var(--light-elevated)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (p.sessions_used / p.total_sessions) * 100)}%`,
                            backgroundColor:
                              remaining === 0 ? "var(--danger)" : "var(--azfit-primary)",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={pkgName}
                onChange={(e) => setPkgName(e.target.value)}
                placeholder="Package name (e.g. 10-pack)"
                aria-label="Package name"
                className={inputCls}
                style={inputStyle}
              />
              <input
                value={pkgSessions}
                onChange={(e) => setPkgSessions(e.target.value)}
                inputMode="numeric"
                placeholder="Total sessions"
                aria-label="Total sessions"
                className={inputCls}
                style={inputStyle}
              />
              <input
                value={pkgPrice}
                onChange={(e) => setPkgPrice(e.target.value)}
                inputMode="decimal"
                placeholder="Price (e.g. 400.00)"
                aria-label="Package price"
                className={inputCls}
                style={inputStyle}
              />
              <input
                type="date"
                value={pkgExpiry}
                onChange={(e) => setPkgExpiry(e.target.value)}
                aria-label="Expiry date (optional)"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleCreatePackage()}
              disabled={savingPkg}
              className="mt-2 h-10 rounded-lg px-4 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--azfit-accent)" }}
            >
              {savingPkg ? "Creating…" : "Create package"}
            </button>
          </Section>

          {/* Log payment */}
          <Section icon={<CircleDollarSign className="h-4 w-4" style={{ color: "var(--success)" }} />} title="Log payment">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                inputMode="decimal"
                placeholder="Amount (e.g. 45.00)"
                aria-label="Payment amount"
                className={inputCls}
                style={inputStyle}
              />
              <select
                value={payKind}
                onChange={(e) => setPayKind(e.target.value)}
                aria-label="Payment kind"
                className={inputCls}
                style={inputStyle}
              >
                <option value="package">Package purchase (prepaid)</option>
                <option value="single_session">Single session</option>
                <option value="other">Other</option>
              </select>
              <select
                value={payPackageId}
                onChange={(e) => setPayPackageId(e.target.value)}
                aria-label="Link to package (optional)"
                className={inputCls}
                style={inputStyle}
              >
                <option value="">No linked package</option>
                {billing.packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Note (optional)"
                aria-label="Payment note"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleLogPayment()}
              disabled={savingPay}
              className="mt-2 h-10 rounded-lg px-4 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--azfit-primary)" }}
            >
              {savingPay ? "Saving…" : "Log payment"}
            </button>
          </Section>

          {/* Payment history */}
          <Section icon={<PackageIcon className="h-4 w-4" style={{ color: "var(--azfit-primary)" }} />} title="Payment history">
            {billing.payments.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
                No payments logged yet.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                {billing.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm" style={{ color: "var(--page-text)" }}>
                        {kindLabel(p.kind)}
                      </span>
                      <span className="block truncate text-xs" style={{ color: "var(--light-text-muted)" }}>
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold" style={{ color: "var(--page-text)" }}>
                      {formatCents(p.amount_cents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "package":
      return "Package purchase";
    case "package_session":
      return "Package session";
    case "single_session":
      return "Single session";
    default:
      return "Other";
  }
}

/** Chart tooltip — token-styled, money via formatCents (strict-TS friendly:
 *  recharts' own formatter types fight `noImplicitAny`, a custom content
 *  component keeps the payload untangled). */
function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const cents = Number(payload[0]?.value ?? 0);
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs"
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <span style={{ color: "var(--light-text-muted)" }}>{label}</span>{" "}
      <strong style={{ color: "var(--page-text)" }}>{formatCents(cents)}</strong>
    </div>
  );
}

/** Phase 96b Overview — everything below is REAL sums of the payments the
 *  trainer can see (RLS-scoped); no number is derived or fabricated.
 *  HONEST DATA: zero payments → single empty state, chart/by-kind/top-5
 *  hidden rather than zeroed. */
function Overview({
  payments,
  expenses,
  nameOf,
}: {
  payments: PaymentLike[];
  expenses: ExpenseLike[];
  nameOf: (clientId: string) => string;
}) {
  const now = new Date();
  const kpi = kpiSums(payments, now);
  const thisKey = monthKeyLocal(now);
  const net = netProfit(kpi.thisMonth, monthExpenses(expenses, thisKey));
  const months = monthlyRevenue(payments, now, 6);
  const kinds = byKindBreakdown(payments);
  const top = topClientsByRevenue(payments, nameOf, 5);

  const kpiCard = (label: string, value: string, tone?: "danger" | "success") => (
    <div
      className="rounded-xl border p-3"
      style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
    >
      <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
        {label}
      </p>
      <p
        className="mt-1 text-lg font-bold"
        style={{
          color:
            tone === "danger" ? "var(--danger)" : tone === "success" ? "var(--success)" : "var(--page-text)",
        }}
      >
        {value}
      </p>
    </div>
  );

  return (
    <section className="mb-4" aria-label="Revenue overview">
      <h2
        className="mb-2 flex items-center gap-2 text-sm font-semibold"
        style={{ color: "var(--page-text)" }}
      >
        <TrendingUp className="h-4 w-4" style={{ color: "var(--azfit-primary)" }} />
        Overview
      </h2>

      {payments.length === 0 ? (
        <div
          className="rounded-2xl border p-4 text-sm"
          style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--light-text-muted)" }}
        >
          No payments yet — log a payment below to see your revenue overview.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {kpiCard("This month", formatCents(kpi.thisMonth))}
            {kpiCard("Last month", formatCents(kpi.lastMonth))}
            {kpiCard("All-time total", formatCents(kpi.allTime))}
            {kpiCard("Sessions logged", String(kpi.count))}
            {kpiCard(
              "Net profit (this month)",
              formatCents(net),
              net < 0 ? "danger" : "success",
            )}
          </div>

          {/* 6-month revenue, LOCAL month buckets (90g convention) */}
          <div
            className="rounded-2xl border p-4"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <p className="mb-2 text-xs font-medium" style={{ color: "var(--light-text-muted)" }}>
              Revenue — last 6 months
            </p>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={months} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--light-border)" opacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--light-text-muted)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--light-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--light-text-muted)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                    tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
                  />
                  <Tooltip content={<RevenueTooltip />} cursor={{ fill: "var(--light-elevated)", opacity: 0.4 }} />
                  <Bar dataKey="cents" fill="var(--azfit-primary)" radius={[4, 4, 0, 0]} animationDuration={600} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* By-kind breakdown — shares reconcile to exactly 100% */}
          <div
            className="rounded-2xl border p-4"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <p className="mb-2 text-xs font-medium" style={{ color: "var(--light-text-muted)" }}>
              By kind
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {kinds.map((k) => (
                <div key={k.kind} className="rounded-xl border p-3" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
                    {kindLabel(k.kind)}
                  </p>
                  <p className="mt-1 text-sm font-bold" style={{ color: "var(--page-text)" }}>
                    {formatCents(k.cents)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
                    {k.sharePct}%
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Top-5 clients by lifetime revenue (account-less included) */}
          <div
            className="rounded-2xl border p-4"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <p className="mb-2 text-xs font-medium" style={{ color: "var(--light-text-muted)" }}>
              Top clients by lifetime revenue
            </p>
            <ol className="divide-y" style={{ borderColor: "var(--card-border)" }}>
              {top.map((t, i) => (
                <li key={t.clientId} className="flex items-center justify-between gap-2 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm" style={{ color: "var(--page-text)" }}>
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: "var(--light-elevated)", color: "var(--light-text-muted)" }}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate">{t.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold" style={{ color: "var(--page-text)" }}>
                    {formatCents(t.cents)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
