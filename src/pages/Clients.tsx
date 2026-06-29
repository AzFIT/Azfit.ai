import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Search, Plus, Edit3 } from "lucide-react";
import Layout from "@/components/Layout";
import QuickAddClientModal from "@/components/QuickAddClientModal";
import { deleteClient, getClients } from "@/lib/storage";
import type { StoredClient } from "@/lib/storage";

export default function ClientsPage() {
  const [mode, setMode] = useState<"dashboard" | "sheets">("dashboard");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "All" | "Active" | "Paused" | "Archived"
  >("All");
  const [clients, setClients] = useState<StoredClient[]>(() => getClients());
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const navigate = useNavigate();

  const loadClients = () => {
    setClients(getClients());
  };

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
    setIsQuickAddOpen(true);
  };

  const openEditClient = (client?: StoredClient) => {
    const target = client || selectedClient;
    if (!target) return;
    navigate(`/client/${target.id}`);
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

  const handleQuickAddSuccess = (client: StoredClient) => {
    loadClients();
    setSelectedClientId(client.id);
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

      {/* Quick Add Client Modal */}
      <QuickAddClientModal
        open={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={handleQuickAddSuccess}
      />
    </Layout>
  );
}
