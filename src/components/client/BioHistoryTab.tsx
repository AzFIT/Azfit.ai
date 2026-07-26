import { useState, useMemo, Fragment } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Weight,
  Ruler,
  Percent,
  Calendar,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { useBodyComposition } from "@/components/bodycomp/useBodyComposition";
import { AssessmentWizard } from "@/components/bodycomp/AssessmentWizard";
import type { SkinfoldProtocol, SkinfoldSite } from "@/lib/bodyfat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BioHistoryTabProps {
  clientId: string; // clients.id — body_composition / skinfold_assessments key on it
  openAdd?: "weight" | "bodyFat" | null; // pre-open the quick-add dialog (tile hint)
}

interface DisplayEntry {
  id: string;
  kind: "body_composition" | "assessment";
  date: string;
  weight: number | null;
  bodyFatPercentage: number | null;
  bmi: number | null;
  waistCm: number | null;
  // assessment-only detail
  protocol?: SkinfoldProtocol;
  sumMm?: number | null;
  ageYears?: number | null;
  sites?: Partial<Record<SkinfoldSite, number>>;
  notes?: string | null;
}

const PROTOCOL_LABELS: Record<SkinfoldProtocol, string> = {
  jp3: "JP-3",
  jp7: "JP-7",
  poliquin12: "Poliquin 12-site",
};

function formatSiteName(site: string): string {
  return site.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

type MetricKey = "weight" | "bodyFat" | "bmi" | "waist";

function metricValue(e: DisplayEntry, key: MetricKey): number | null {
  switch (key) {
    case "weight":
      return e.weight;
    case "bodyFat":
      return e.bodyFatPercentage;
    case "bmi":
      return e.bmi;
    case "waist":
      return e.waistCm;
  }
}

export default function BioHistoryTab({ clientId, openAdd = null }: BioHistoryTabProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("weight");
  // The tab remounts on every tab switch, so this initial state applies
  // exactly when arriving via a tile hint.
  const [addOpen, setAddOpen] = useState<"weight" | "bodyFat" | null>(openAdd);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  // skipLegacyMigration: this view opens OTHER clients' records — a legacy
  // localStorage import must never write into the viewed client's rows.
  const { history, loading, saveBodyComposition, fetchData } = useBodyComposition(clientId, {
    skipLegacyMigration: true,
  });

  // Show the spinner until the first fetch completes — the hook reports
  // loading=true from mount when a clientId is provided.
  const showSpinner = loading;

  const entries = useMemo<DisplayEntry[]>(
    () =>
      history
        .map((item): DisplayEntry => {
          if (item.kind === "body_composition") {
            const d = item.data;
            return {
              id: item.id,
              kind: "body_composition",
              date: item.date,
              weight: d.weight_kg,
              bodyFatPercentage: d.body_fat_percentage,
              bmi: d.bmi,
              waistCm: d.waist_cm,
            };
          }
          const d = item.data;
          return {
            id: item.id,
            kind: "assessment",
            date: item.date,
            weight: d.weight_kg,
            bodyFatPercentage: d.body_fat_pct,
            bmi: null,
            waistCm: null,
            protocol: d.protocol,
            sumMm: d.sum_mm,
            ageYears: d.age_years,
            sites: (d.sites as Partial<Record<SkinfoldSite, number>>) || {},
            notes: d.notes,
          };
        })
        .filter(
          (e) =>
            e.kind === "assessment" ||
            e.weight != null ||
            e.bodyFatPercentage != null ||
            e.bmi != null ||
            e.waistCm != null,
        ),
    [history],
  );

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [entries],
  );

  if (showSpinner) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
          />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <AddEntryButton onClick={() => setAddOpen("weight")} />
        </div>
        <div
          className="flex flex-col items-center justify-center rounded-2xl border py-12"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <Activity size={32} style={{ color: "var(--light-text-muted)" }} />
          <p
            className="mt-2 text-sm font-medium"
            style={{ color: "var(--light-text-muted)" }}
          >
            No bio history recorded
          </p>
        </div>
        <AddEntryDialog
          key={addOpen ?? "closed"}
          open={addOpen}
          onOpenChange={setAddOpen}
          onSave={saveBodyComposition}
          onOpenWizard={() => { setAddOpen(null); setWizardOpen(true); }}
        />
        <AssessmentWizard
          clientId={clientId}
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onSaved={() => { fetchData(); }}
        />
      </div>
    );
  }

  const latestWithMetric = [...sorted]
    .reverse()
    .find((e) => metricValue(e, activeMetric) != null);
  const previousWithMetric = [...sorted]
    .reverse()
    .filter((e) => metricValue(e, activeMetric) != null)[1];

  const chartData = sorted.map((e) => ({
    date: new Date(e.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    weight: e.weight,
    bodyFat: e.bodyFatPercentage,
    bmi: e.bmi,
    waist: e.waistCm,
  }));

  const metricConfig = {
    weight: { label: "Weight", unit: "kg", color: "#0D9488", icon: Weight },
    bodyFat: { label: "Body Fat", unit: "%", color: "#8B5CF6", icon: Percent },
    bmi: { label: "BMI", unit: "", color: "#06B6D4", icon: Activity },
    waist: { label: "Waist", unit: "cm", color: "#F59E0B", icon: Ruler },
  };

  const latestValue = latestWithMetric
    ? metricValue(latestWithMetric, activeMetric)
    : null;
  const previousValue = previousWithMetric
    ? metricValue(previousWithMetric, activeMetric)
    : null;
  const change =
    latestValue != null && previousValue != null
      ? +(latestValue - previousValue).toFixed(1)
      : 0;

  return (
    <div className="space-y-4">
      {/* Quick-add */}
      <div className="flex justify-end">
        <AddEntryButton onClick={() => setAddOpen("weight")} />
      </div>

      {/* Metric Selector */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map(
          (key) => {
            const cfg = metricConfig[key];
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                className="flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all"
                style={{
                  backgroundColor:
                    activeMetric === key ? `${cfg.color}15` : "var(--card-bg)",
                  borderColor:
                    activeMetric === key ? cfg.color : "var(--card-border)",
                }}
              >
                <Icon size={16} style={{ color: cfg.color }} />
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color:
                      activeMetric === key
                        ? cfg.color
                        : "var(--light-text-muted)",
                  }}
                >
                  {cfg.label}
                </span>
              </button>
            );
          },
        )}
      </div>

      {/* Latest Value */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
              Latest {metricConfig[activeMetric].label}
            </p>
            <p
              className="text-2xl font-bold"
              style={{ color: metricConfig[activeMetric].color }}
            >
              {latestValue != null ? latestValue : "—"}
              <span
                className="text-sm font-normal ml-1"
                style={{ color: "var(--light-text-muted)" }}
              >
                {metricConfig[activeMetric].unit}
              </span>
            </p>
          </div>
          {change !== 0 && (
            <div
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: change < 0 ? "var(--success)" : "var(--danger)" }}
            >
              {change < 0 ? (
                <TrendingDown size={14} />
              ) : (
                <TrendingUp size={14} />
              )}
              {change > 0 ? "+" : ""}
              {change} {metricConfig[activeMetric].unit}
            </div>
          )}
        </div>
      </motion.div>

      {/* Chart */}
      <div
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: "var(--page-text)" }}
        >
          {metricConfig[activeMetric].label} History
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--card-border)"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--light-text-muted)" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--light-text-muted)" }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                itemStyle={{ color: "var(--page-text)" }}
              />
              <Line
                type="monotone"
                dataKey={
                  activeMetric === "bodyFat"
                    ? "bodyFat"
                    : activeMetric === "waist"
                      ? "waist"
                      : activeMetric
                }
                stroke={metricConfig[activeMetric].color}
                strokeWidth={2}
                dot={{ fill: metricConfig[activeMetric].color, r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: "var(--light-elevated)" }}>
                <th
                  className="px-3 py-2 text-left font-medium"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  Date
                </th>
                <th
                  className="px-3 py-2 text-left font-medium"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  Weight
                </th>
                <th
                  className="px-3 py-2 text-left font-medium"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  Body Fat
                </th>
                <th
                  className="px-3 py-2 text-left font-medium"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  BMI
                </th>
                <th
                  className="px-3 py-2 text-left font-medium"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  Waist
                </th>
              </tr>
            </thead>
            <tbody>
              {[...sorted].reverse().map((entry) => {
                const isAssessment = entry.kind === "assessment";
                const expanded = !!expandedRows[entry.id];
                return (
                  <Fragment key={entry.id}>
                    <tr
                      className="border-t"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      <td
                        className="px-3 py-2"
                        style={{ color: "var(--page-text)" }}
                      >
                        <div className="flex items-center gap-1.5">
                          {isAssessment ? (
                            <button
                              onClick={() =>
                                setExpandedRows((prev) => ({
                                  ...prev,
                                  [entry.id]: !prev[entry.id],
                                }))
                              }
                              className="p-0.5 rounded hover:opacity-80"
                              title="Show skinfold detail"
                            >
                              {expanded ? (
                                <ChevronUp size={12} style={{ color: "var(--azfit-primary)" }} />
                              ) : (
                                <ChevronDown size={12} style={{ color: "var(--azfit-primary)" }} />
                              )}
                            </button>
                          ) : (
                            <Calendar
                              size={10}
                              style={{ color: "var(--light-text-muted)" }}
                            />
                          )}
                          <span>
                            {new Date(entry.date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                            ,{" "}
                            {new Date(entry.date).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {isAssessment && entry.protocol && (
                              <span
                                className="ml-1.5 rounded px-1 py-0.5 text-[9px] font-semibold"
                                style={{ background: "rgba(139,92,246,0.15)", color: "#8B5CF6" }}
                              >
                                {PROTOCOL_LABELS[entry.protocol]}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-3 py-2 font-medium"
                        style={{ color: "#0D9488" }}
                      >
                        {entry.weight != null ? `${entry.weight} kg` : "—"}
                      </td>
                      <td
                        className="px-3 py-2 font-medium"
                        style={{ color: "#8B5CF6" }}
                      >
                        {entry.bodyFatPercentage != null
                          ? `${entry.bodyFatPercentage}%`
                          : "—"}
                      </td>
                      <td
                        className="px-3 py-2 font-medium"
                        style={{ color: "#06B6D4" }}
                      >
                        {entry.bmi != null ? entry.bmi : "—"}
                      </td>
                      <td
                        className="px-3 py-2 font-medium"
                        style={{ color: "#F59E0B" }}
                      >
                        {entry.waistCm != null ? `${entry.waistCm} cm` : "—"}
                      </td>
                    </tr>
                    {isAssessment && expanded && (
                      <tr
                        className="border-t"
                        style={{ borderColor: "var(--card-border)", backgroundColor: "var(--light-elevated)" }}
                      >
                        <td colSpan={5} className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-[11px]">
                            <span style={{ color: "var(--page-text)" }}>
                              <span style={{ color: "var(--light-text-muted)" }}>Protocol: </span>
                              {entry.protocol ? PROTOCOL_LABELS[entry.protocol] : "—"}
                            </span>
                            <span style={{ color: "var(--page-text)" }}>
                              <span style={{ color: "var(--light-text-muted)" }}>Sum: </span>
                              {entry.sumMm != null ? `${entry.sumMm} mm` : "—"}
                            </span>
                            <span style={{ color: "var(--page-text)" }}>
                              <span style={{ color: "var(--light-text-muted)" }}>Age: </span>
                              {entry.ageYears != null ? `${entry.ageYears} yrs` : "—"}
                            </span>
                          </div>
                          {entry.sites && Object.keys(entry.sites).length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                              {Object.entries(entry.sites).map(([site, mm]) => (
                                <div
                                  key={site}
                                  className="rounded-lg border px-2 py-1 text-[10px]"
                                  style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
                                >
                                  <span style={{ color: "var(--light-text-muted)" }}>{formatSiteName(site)}: </span>
                                  <span className="font-semibold" style={{ color: "var(--page-text)" }}>{mm} mm</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {entry.notes && (
                            <p className="text-[11px] italic" style={{ color: "var(--light-text-muted)" }}>
                              "{entry.notes}"
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AddEntryDialog
        key={addOpen ?? "closed"}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={saveBodyComposition}
        onOpenWizard={() => { setAddOpen(null); setWizardOpen(true); }}
      />
      <AssessmentWizard
        clientId={clientId}
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSaved={() => { fetchData(); }}
      />
    </div>
  );
}

function AddEntryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
      style={{ backgroundColor: "var(--azfit-primary)" }}
    >
      <Plus size={14} />
      Add entry
    </button>
  );
}

function AddEntryDialog({
  open,
  onOpenChange,
  onSave,
  onOpenWizard,
}: {
  open: "weight" | "bodyFat" | null;
  onOpenChange: (v: "weight" | "bodyFat" | null) => void;
  onSave: (input: {
    recorded_at?: string;
    weight_kg: number | null;
    body_fat_percentage: number | null;
  }) => Promise<boolean>;
  onOpenWizard: () => void;
}) {
  const [type, setType] = useState<"weight" | "bodyFat">(open ?? "weight");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [saving, setSaving] = useState(false);

  const isWeight = type === "weight";
  const num = parseFloat(value);
  const valueValid = Number.isFinite(num) && (isWeight ? num >= 20 && num <= 300 : num >= 2 && num <= 60);
  const today = new Date().toISOString().split("T")[0];
  const dateValid = !!date && date <= today;
  const valid = valueValid && dateValid && !!time;

  const handleSave = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const recorded = new Date(`${date}T${time}:00`).toISOString();
      const ok = await onSave({
        recorded_at: recorded,
        weight_kg: isWeight ? num : null,
        body_fat_percentage: isWeight ? null : num,
      });
      if (ok) onOpenChange(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open !== null} onOpenChange={(v) => { if (!v) onOpenChange(null); }}>
      <DialogContent className="max-w-sm border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#F0F0F0]">
            Add {isWeight ? "weight" : "body fat"} entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["weight", "bodyFat"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className="rounded-lg border px-3 py-2 text-sm font-medium transition-all"
                style={{
                  borderColor: type === t ? "var(--azfit-primary)" : "#2A3447",
                  color: type === t ? "var(--azfit-primary)" : "#94A3B8",
                  backgroundColor: type === t ? "rgba(0,174,239,0.1)" : "transparent",
                }}
              >
                {t === "weight" ? "Weight (kg)" : "Body fat (%)"}
              </button>
            ))}
          </div>

          <div>
            <Label className="text-sm text-[#94A3B8]">
              {isWeight ? "Weight (kg)" : "Body fat (%)"}
            </Label>
            <Input
              type="number"
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isWeight ? "e.g. 80.5" : "e.g. 18.5"}
              className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
              autoFocus
            />
            {value !== "" && !valueValid && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {isWeight ? "Enter 20–300 kg" : "Enter 2–60 %"}
              </p>
            )}
          </div>

          {!isWeight && (
            <div>
              <div className="flex items-center gap-2 my-1">
                <div className="h-px flex-1" style={{ backgroundColor: "#2A3447" }} />
                <span className="text-[10px] uppercase tracking-wide text-[#64748B]">or</span>
                <div className="h-px flex-1" style={{ backgroundColor: "#2A3447" }} />
              </div>
              <button
                onClick={onOpenWizard}
                className="w-full rounded-lg border px-3 py-2.5 text-sm font-medium transition-all hover:opacity-90"
                style={{ borderColor: "#8B5CF6", color: "#8B5CF6", backgroundColor: "rgba(139,92,246,0.08)" }}
              >
                Skinfold caliper assessment →
              </button>
              <p className="mt-1 text-center text-[10px] text-[#64748B]">
                JP-3 / JP-7 / Poliquin 12-site with live body-fat calculation
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm text-[#94A3B8]">Date</Label>
              <Input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
              />
            </div>
            <div>
              <Label className="text-sm text-[#94A3B8]">Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(null)}
            className="border-[#2A3447] text-[#94A3B8]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!valid || saving}
            className="bg-[#00AEEF] text-white hover:bg-[#00AEEF]/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
