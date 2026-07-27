import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Search, Plus, Edit3, Upload, X, User, ChevronDown } from "lucide-react";
import Layout from "@/components/Layout";
import QuickAddClientModal from "@/components/QuickAddClientModal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_VALUES,
  clientStatusMeta,
  type ClientStatus,
} from "@/lib/clientStatus";
import type { Database } from "@/types/supabase";

type DbClient = Database["public"]["Tables"]["clients"]["Row"];

type LegacyClient = {
  id?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  status?: string;
  dateOfBirth?: string;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  bodyFatPercent?: number;
  fitnessGoal?: string;
  experienceLevel?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

function mapLegacyStatus(status: string): DbClient["status"] {
  if (status === "active") return "active";
  if (status === "paused" || status === "on_hold") return "paused";
  if (status === "archived") return "archived";
  return "active";
}

/** Filter: a chip name, or `other:<status>` for the long tail via the Other menu. */
type StatusFilter = "All" | "Active" | "Paused" | "Archived" | `other:${ClientStatus}`;

const OTHER_STATUSES = CLIENT_STATUS_VALUES.filter(
  (v) => v !== "active" && v !== "paused" && v !== "archived",
);

export default function ClientsPage() {
  const [mode, setMode] = useState<"dashboard" | "sheets">("dashboard");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("Active");
  const [otherMenuOpen, setOtherMenuOpen] = useState(false);
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [clients, setClients] = useState<DbClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<DbClient | null>(null);
  const [legacyClients, setLegacyClients] = useState<LegacyClient[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  const loadClients = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("trainer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load clients: " + error.message);
      setLoading(false);
      return;
    }

    setClients(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Escape closes any open status/filter menu
  useEffect(() => {
    if (!statusMenuFor && !otherMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStatusMenuFor(null);
        setOtherMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [statusMenuFor, otherMenuOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("azfit_clients");
      if (raw) {
        const parsed = JSON.parse(raw) as LegacyClient[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLegacyClients(parsed);
        }
      }
    } catch {
      // ignore malformed localStorage
    }
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        !search ||
        client.full_name.toLowerCase().includes(search.toLowerCase()) ||
        client.email.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "Active"
          ? client.status === "active"
          : filter === "Paused"
            ? client.status === "paused"
            : filter === "Archived"
              ? client.status === "archived"
              : filter === "All"
                ? client.status !== "archived"
                : client.status === filter.slice(6); // other:<status>
      return matchesSearch && matchesFilter;
    });
  }, [clients, search, filter]);

  const handleStatusChange = useCallback(
    async (client: DbClient, next: ClientStatus) => {
      setStatusMenuFor(null);
      if (next === client.status) return;
      const prev = client.status;
      // Optimistic update; revert on error
      setClients((cs) => cs.map((c) => (c.id === client.id ? { ...c, status: next } : c)));
      const { error } = await supabase
        .from("clients")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", client.id);
      if (error) {
        setClients((cs) => cs.map((c) => (c.id === client.id ? { ...c, status: prev } : c)));
        toast.error("Failed to update status: " + error.message);
      } else {
        toast.success(`${client.full_name} → ${clientStatusMeta(next).label}`);
      }
    },
    [],
  );

  const selectedClient = selectedClientId
    ? (clients.find((client) => client.id === selectedClientId) ?? null)
    : null;

  const openAddClient = () => {
    setEditingClient(null);
    setIsQuickAddOpen(true);
  };

  const openEditClient = (client?: DbClient) => {
    const target = client || selectedClient;
    if (!target) return;
    setEditingClient(target);
    setIsQuickAddOpen(true);
  };

  const handleArchiveClient = async (clientId: string) => {
    if (
      !window.confirm("Archive this client? They will be hidden from the active list.")
    ) {
      return;
    }
    if (!user) return;

    const { error } = await supabase
      .from("clients")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", clientId)
      .eq("trainer_id", user.id);

    if (error) {
      toast.error("Failed to archive client: " + error.message);
      return;
    }

    toast.success("Client archived");
    loadClients();
    if (selectedClientId === clientId) {
      setSelectedClientId(null);
    }
  };

  const handleImportLegacy = async () => {
    if (!user || legacyClients.length === 0) return;

    let imported = 0;
    let failed = 0;

    for (const lc of legacyClients) {
      const insert: Database["public"]["Tables"]["clients"]["Insert"] = {
        trainer_id: user.id,
        full_name: (lc.fullName || "Unnamed").trim(),
        email: (lc.email || "").trim(),
        phone: lc.phone || null,
        status: mapLegacyStatus(lc.status || "active"),
        date_of_birth: lc.dateOfBirth || null,
        gender:
          lc.gender === "male" || lc.gender === "female" || lc.gender === "other"
            ? lc.gender
            : null,
        height_cm: typeof lc.heightCm === "number" ? lc.heightCm : null,
        weight_kg: typeof lc.weightKg === "number" ? lc.weightKg : null,
        body_fat_percentage: typeof lc.bodyFatPercent === "number" ? lc.bodyFatPercent : null,
        fitness_goal: lc.fitnessGoal || null,
        experience_level:
          lc.experienceLevel === "beginner" ||
          lc.experienceLevel === "intermediate" ||
          lc.experienceLevel === "advanced"
            ? lc.experienceLevel
            : null,
        notes: lc.notes || null,
      };

      try {
        const { error } = await supabase.from("clients").insert(insert);
        if (error) throw error;
        imported++;
      } catch {
        failed++;
      }
    }

    localStorage.removeItem("azfit_clients");
    setLegacyClients([]);
    toast.success(
      `Imported ${imported} of ${legacyClients.length} clients${failed > 0 ? ` (${failed} failed)` : ""}`
    );
    loadClients();
  };

  const dismissLegacyBanner = () => {
    localStorage.removeItem("azfit_clients");
    setLegacyClients([]);
  };

  return (
    <Layout mode={mode} onModeToggle={setMode}>
      <div className="mx-auto max-w-[1200px] px-4 pt-20 pb-10 lg:px-6">
        {/* Legacy import banner */}
        {legacyClients.length > 0 && (
          <div
            className="mb-4 flex flex-col items-start justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(13,148,136,0.12)" }}
              >
                <Upload size={18} style={{ color: "var(--azfit-primary)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
                  {legacyClients.length} client{legacyClients.length !== 1 ? "s" : ""} saved on this device
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Import them to the cloud so they appear everywhere.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImportLegacy}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--azfit-primary)" }}
              >
                Import
              </button>
              <button
                onClick={dismissLegacyBanner}
                className="rounded-full p-2 hover:bg-white/5"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        <div
          className="mb-6 flex flex-col gap-4 rounded-2xl border bg-[var(--card-bg)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--card-border)" }}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--light-text-muted)]">
              Clients
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--page-text)]">
              Client List
            </h1>
            {selectedClient && (
              <p className="mt-2 text-sm text-[var(--light-text-muted)]">
                Selected client: {selectedClient.full_name}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openAddClient}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--azfit-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b776d]"
            >
              <Plus size={16} />
              Add New Client
            </button>
            <button
              type="button"
              onClick={() => openEditClient()}
              disabled={!selectedClient}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--light-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Edit3 size={16} />
              Edit Client
            </button>
            <button
              type="button"
              onClick={() =>
                selectedClient && handleArchiveClient(selectedClient.id)
              }
              disabled={!selectedClient}
              className="inline-flex items-center gap-2 rounded-full border border-red-500 bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-[rgba(239,68,68,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Archive Client
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          <div
            className="flex flex-col gap-3 rounded-2xl border bg-[var(--card-bg)] p-4"
            style={{ borderColor: "var(--card-border)" }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search
                  size={16}
                  className="absolute left-3 top-3 text-[var(--light-text-muted)]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search clients"
                  className="h-11 w-full rounded-xl border bg-[var(--page-bg)] pl-10 pr-4 text-sm outline-none"
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--page-text)",
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["All", "Active", "Paused", "Archived"] as const).map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => { setFilter(option); setOtherMenuOpen(false); }}
                      className="rounded-full px-3 py-2 text-xs font-semibold transition"
                      style={{
                        backgroundColor:
                          filter === option
                            ? "var(--azfit-primary)"
                            : "transparent",
                        color:
                          filter === option
                            ? "#fff"
                            : "var(--light-text-muted)",
                        border: `1px solid var(--card-border)`,
                      }}
                    >
                      {option}
                    </button>
                  )
                )}
                {/* Other statuses menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOtherMenuOpen((o) => !o)}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold transition"
                    style={{
                      backgroundColor: filter.startsWith("other:")
                        ? "var(--azfit-primary)"
                        : "transparent",
                      color: filter.startsWith("other:")
                        ? "#fff"
                        : "var(--light-text-muted)",
                      border: `1px solid var(--card-border)`,
                    }}
                  >
                    {filter.startsWith("other:")
                      ? clientStatusMeta(filter.slice(6)).label
                      : "Other"}
                    <ChevronDown size={11} />
                  </button>
                  {otherMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setOtherMenuOpen(false)} />
                      <div
                        className="absolute right-0 z-50 mt-1 w-56 rounded-xl border overflow-y-auto shadow-xl"
                        style={{
                          backgroundColor: "var(--card-bg)",
                          borderColor: "var(--card-border)",
                          maxHeight: 320,
                          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                        }}
                      >
                        {OTHER_STATUSES.map((v) => {
                          const m = CLIENT_STATUSES[v];
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => { setFilter(`other:${v}`); setOtherMenuOpen(false); }}
                              className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[var(--light-elevated)]"
                            >
                              <span className="text-xs font-semibold" style={{ color: m.color }}>
                                {m.label}{filter === `other:${v}` && " ✓"}
                              </span>
                              <span className="text-[10px]" style={{ color: "var(--light-text-muted)" }}>
                                {m.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--card-border)]">
              <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-0 bg-[var(--light-elevated)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--light-text-muted)]">
                <span>Name</span>
                <span>Email</span>
                <span>Status</span>
                <span className="text-right">Action</span>
              </div>
              <div className="divide-y divide-[var(--card-border)] bg-[var(--card-bg)]">
                {loading ? (
                  <div className="px-4 py-10 text-center text-sm text-[var(--light-text-muted)]">
                    Loading clients...
                  </div>
                ) : (
                  <>
                    {filteredClients.map((client) => {
                      const isSelected = client.id === selectedClientId;
                      return (
                        <motion.div
                          key={client.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -1 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              navigate(`/client/${client.id}`);
                            }
                          }}
                          style={{
                            // The open status dropdown must paint ABOVE later
                            // (transformed) rows — give this row its own
                            // stacking context while its menu is open.
                            position: "relative",
                            zIndex: statusMenuFor === client.id ? 30 : 0,
                          }}
                          className={`flex w-full cursor-pointer items-center gap-4 px-4 py-4 transition ${
                            isSelected
                              ? "bg-[var(--light-elevated)] shadow-sm"
                              : "hover:bg-[var(--light-elevated)]"
                          }`}
                          onClick={() => navigate(`/client/${client.id}`)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-semibold text-[var(--page-text)]">
                              {client.full_name}
                            </p>
                            <p className="truncate text-sm text-[var(--light-text-muted)]">
                              {client.email}
                            </p>
                          </div>
                          <div
                            className="w-1/4 relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(() => {
                              const meta = clientStatusMeta(client.status);
                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setStatusMenuFor(
                                        statusMenuFor === client.id ? null : client.id,
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80"
                                    style={{ backgroundColor: meta.bg, color: meta.color }}
                                    title="Change status"
                                  >
                                    {meta.label}
                                    <ChevronDown size={11} />
                                  </button>
                                  {statusMenuFor === client.id && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setStatusMenuFor(null)}
                                      />
                                      <div
                                        className="absolute left-0 z-50 mt-1 w-60 rounded-xl border overflow-y-auto shadow-xl"
                                        style={{
                                          backgroundColor: "var(--card-bg)",
                                          borderColor: "var(--card-border)",
                                          maxHeight: 320,
                                          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                                        }}
                                      >
                                        {CLIENT_STATUS_VALUES.map((v) => {
                                          const m = CLIENT_STATUSES[v];
                                          return (
                                            <button
                                              key={v}
                                              type="button"
                                              onClick={() => handleStatusChange(client, v)}
                                              className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[var(--light-elevated)]"
                                            >
                                              <span
                                                className="text-xs font-semibold"
                                                style={{ color: m.color }}
                                              >
                                                {m.label}
                                                {v === client.status && " ✓"}
                                              </span>
                                              <span
                                                className="text-[10px]"
                                                style={{ color: "var(--light-text-muted)" }}
                                              >
                                                {m.description}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditClient(client);
                              }}
                              className="rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs font-semibold transition hover:bg-[var(--light-elevated)]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/client/${client.id}`);
                              }}
                              className="rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs font-semibold transition hover:bg-[var(--light-elevated)]"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleArchiveClient(client.id);
                              }}
                              className="rounded-full border border-red-500 bg-[var(--card-bg)] px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-[rgba(239,68,68,0.08)]"
                            >
                              Archive
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                    {filteredClients.length === 0 && (
                      <div className="px-4 py-12 text-center">
                        <div
                          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                          style={{ backgroundColor: "rgba(13,148,136,0.12)" }}
                        >
                          <User size={22} style={{ color: "var(--azfit-primary)" }} />
                        </div>
                        <p className="text-sm font-medium text-[var(--page-text)]">
                          No clients yet — add your first client.
                        </p>
                        <button
                          onClick={openAddClient}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--azfit-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b776d]"
                        >
                          <Plus size={16} />
                          Add New Client
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add / Edit Client Modal */}
      <QuickAddClientModal
        open={isQuickAddOpen}
        onClose={() => {
          setIsQuickAddOpen(false);
          setEditingClient(null);
        }}
        onSuccess={() => {
          loadClients();
          setIsQuickAddOpen(false);
          setEditingClient(null);
        }}
        clientToEdit={editingClient}
      />
    </Layout>
  );
}
