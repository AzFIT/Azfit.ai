import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Search, Plus, Edit3, X } from "lucide-react";
import Layout from "@/components/Layout";
import { deleteClient, getClients, saveClient } from "@/lib/storage";
import type { StoredClient } from "@/lib/storage";

const initialFormState: Partial<StoredClient> = {
  fullName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "other",
  heightCm: undefined,
  weightKg: undefined,
  bodyFatPercent: undefined,
  fitnessGoal: "",
  experienceLevel: "beginner",
  status: "active",
};

export default function ClientsPage() {
  const [mode, setMode] = useState<"dashboard" | "sheets">("dashboard");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "All" | "Active" | "Paused" | "Archived"
  >("All");
  const [clients, setClients] = useState<StoredClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formValues, setFormValues] =
    useState<Partial<StoredClient>>(initialFormState);
  const navigate = useNavigate();

  const loadClients = () => {
    setClients(getClients());
  };

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        !search ||
        client.fullName.toLowerCase().includes(search.toLowerCase()) ||
        client.email.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "All" ||
        (filter === "Active" && client.status === "active") ||
        (filter === "Paused" && client.status === "paused") ||
        (filter === "Archived" && client.status === "archived");
      return matchesSearch && matchesFilter;
    });
  }, [clients, search, filter]);

  const selectedClient = selectedClientId
    ? (clients.find((client) => client.id === selectedClientId) ?? null)
    : null;

  const openAddClient = () => {
    setFormMode("add");
    setFormValues(initialFormState);
    setIsFormOpen(true);
  };

  const openEditClient = (client?: StoredClient) => {
    const target = client || selectedClient;
    if (!target) return;
    setFormMode("edit");
    setFormValues(target);
    setSelectedClientId(target.id);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setFormValues(initialFormState);
  };

  const handleFormChange = (key: keyof StoredClient, value: string) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const handleSaveClient = () => {
    if (!formValues.fullName?.trim() || !formValues.email?.trim()) {
      toast.error("Full name and email are required.");
      return;
    }

    const now = new Date().toISOString();
    const client: StoredClient = {
      id:
        formMode === "edit" && formValues.id
          ? formValues.id
          : `client-${Date.now()}`,
      fullName: formValues.fullName?.trim() ?? "",
      email: formValues.email?.trim() ?? "",
      phone: formValues.phone?.trim() ?? "",
      dateOfBirth: formValues.dateOfBirth ?? "",
      gender: (formValues.gender as StoredClient["gender"]) || "other",
      heightCm: formValues.heightCm ? Number(formValues.heightCm) : undefined,
      weightKg: formValues.weightKg ? Number(formValues.weightKg) : undefined,
      bodyFatPercent: formValues.bodyFatPercent
        ? Number(formValues.bodyFatPercent)
        : undefined,
      fitnessGoal: formValues.fitnessGoal ?? "",
      experienceLevel:
        (formValues.experienceLevel as StoredClient["experienceLevel"]) ||
        "beginner",
      status: (formValues.status as StoredClient["status"]) || "active",
      createdAt:
        formMode === "edit" && formValues.createdAt
          ? formValues.createdAt
          : now,
      updatedAt: now,
    };

    saveClient(client);
    loadClients();
    setSelectedClientId(client.id);
    closeForm();
    toast.success(
      formMode === "add"
        ? "Client added successfully."
        : "Client updated successfully.",
    );
  };

  const handleDeleteClient = (clientId: string) => {
    if (!window.confirm("Delete this client? This action cannot be undone.")) {
      return;
    }

    deleteClient(clientId);
    loadClients();
    if (selectedClientId === clientId) {
      setSelectedClientId(null);
    }
    toast.success("Client deleted successfully.");
  };

  return (
    <Layout mode={mode} onModeToggle={setMode}>
      <div className="mx-auto max-w-[1200px] px-4 pt-20 pb-10 lg:px-6">
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
                Selected client: {selectedClient.fullName}
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
                selectedClient && handleDeleteClient(selectedClient.id)
              }
              disabled={!selectedClient}
              className="inline-flex items-center gap-2 rounded-full border border-red-500 bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-[rgba(239,68,68,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete Client
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
                      onClick={() => setFilter(option)}
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
                  ),
                )}
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
                      className={`flex w-full items-center gap-4 px-4 py-4 transition ${
                        isSelected
                          ? "bg-[var(--light-elevated)] shadow-sm"
                          : "hover:bg-[var(--light-elevated)]"
                      }`}
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold text-[var(--page-text)]">
                          {client.fullName}
                        </p>
                        <p className="truncate text-sm text-[var(--light-text-muted)]">
                          {client.email}
                        </p>
                      </div>
                      <div className="w-1/4 text-sm text-[var(--light-text-muted)]">
                        {client.status}
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
                            handleDeleteClient(client.id);
                          }}
                          className="rounded-full border border-red-500 bg-[var(--card-bg)] px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-[rgba(239,68,68,0.08)]"
                        >
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
                {filteredClients.length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-[var(--light-text-muted)]">
                    No clients found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeForm}
          >
            <motion.div
              className="w-full max-w-2xl overflow-hidden rounded-3xl border bg-[var(--card-bg)] p-6 shadow-2xl"
              style={{ borderColor: "var(--card-border)" }}
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--light-text-muted)]">
                    {formMode === "add" ? "New client" : "Edit client"}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--page-text)]">
                    {formMode === "add" ? "Add New Client" : "Update Client"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] transition hover:bg-[var(--light-elevated)]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Full name
                  </span>
                  <input
                    type="text"
                    value={formValues.fullName ?? ""}
                    onChange={(e) =>
                      handleFormChange("fullName", e.target.value)
                    }
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Email
                  </span>
                  <input
                    type="email"
                    value={formValues.email ?? ""}
                    onChange={(e) => handleFormChange("email", e.target.value)}
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Phone
                  </span>
                  <input
                    type="tel"
                    value={formValues.phone ?? ""}
                    onChange={(e) => handleFormChange("phone", e.target.value)}
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Date of birth
                  </span>
                  <input
                    type="date"
                    value={formValues.dateOfBirth ?? ""}
                    onChange={(e) =>
                      handleFormChange("dateOfBirth", e.target.value)
                    }
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Goal
                  </span>
                  <input
                    type="text"
                    value={formValues.fitnessGoal ?? ""}
                    onChange={(e) =>
                      handleFormChange("fitnessGoal", e.target.value)
                    }
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Gender
                  </span>
                  <select
                    value={formValues.gender ?? "other"}
                    onChange={(e) => handleFormChange("gender", e.target.value)}
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Experience
                  </span>
                  <select
                    value={formValues.experienceLevel ?? "beginner"}
                    onChange={(e) =>
                      handleFormChange("experienceLevel", e.target.value)
                    }
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Height (cm)
                  </span>
                  <input
                    type="number"
                    value={formValues.heightCm ?? ""}
                    onChange={(e) =>
                      handleFormChange("heightCm", e.target.value)
                    }
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Weight (kg)
                  </span>
                  <input
                    type="number"
                    value={formValues.weightKg ?? ""}
                    onChange={(e) =>
                      handleFormChange("weightKg", e.target.value)
                    }
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Body fat %
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    value={formValues.bodyFatPercent ?? ""}
                    onChange={(e) =>
                      handleFormChange("bodyFatPercent", e.target.value)
                    }
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="block text-[var(--light-text-muted)]">
                    Status
                  </span>
                  <select
                    value={formValues.status ?? "active"}
                    onChange={(e) => handleFormChange("status", e.target.value)}
                    className="w-full rounded-xl border bg-[var(--page-bg)] px-4 py-3 text-sm outline-none"
                    style={{
                      borderColor: "var(--card-border)",
                      color: "var(--page-text)",
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-3 text-sm font-semibold transition hover:bg-[var(--light-elevated)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveClient}
                  className="rounded-full bg-[var(--azfit-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0b776d]"
                >
                  Save Client
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
