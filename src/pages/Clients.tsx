import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Search, ChevronRight } from "lucide-react";
import ModeToggle from "@/components/ModeToggle";
import Layout from "@/components/Layout";
import { getClients } from "@/lib/storage";
import type { StoredClient } from "@/lib/storage";

export default function ClientsPage() {
  const [mode, setMode] = useState<"dashboard" | "sheets">("dashboard");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "All" | "Active" | "Paused" | "Archived"
  >("All");
  const navigate = useNavigate();

  useEffect(() => {
    const clients = getClients();
    if (clients.length === 0) {
      const sample = [
        {
          id: "client-1",
          fullName: "Alex Chen",
          email: "alex.chen@example.com",
          phone: "+1 (555) 123-4567",
          dateOfBirth: "1997-03-15",
          gender: "male",
          heightCm: 178,
          weightKg: 82,
          bodyFatPercent: 14.2,
          fitnessGoal: "Build muscle",
          experienceLevel: "intermediate",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      sample.forEach((client) => getClients().push(client as StoredClient));
    }
  }, []);

  const clients = useMemo(() => {
    return getClients().filter((client) => {
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
  }, [search, filter]);

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
          </div>
          <ModeToggle mode={mode} onToggle={setMode} />
        </div>

        {mode === "sheets" ? (
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
                <div className="flex gap-2">
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
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-[var(--light-elevated)]"
                      onClick={() => navigate(`/client/${client.id}`)}
                    >
                      <span className="truncate">{client.fullName}</span>
                      <span className="truncate text-sm text-[var(--light-text-muted)]">
                        {client.email}
                      </span>
                      <span className="rounded-full bg-[rgba(13,148,136,0.12)] px-3 py-1 text-[12px] font-semibold text-[#0D9488]">
                        {client.status}
                      </span>
                      <ChevronRight className="ml-auto text-[var(--light-text-muted)]" />
                    </button>
                  ))}
                  {clients.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-[var(--light-text-muted)]">
                      No clients found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {clients.map((client) => (
              <motion.button
                key={client.id}
                type="button"
                onClick={() => navigate(`/client/${client.id}`)}
                className="group rounded-3xl border bg-[var(--card-bg)] p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ borderColor: "var(--card-border)" }}
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(13,148,136,0.12)] text-2xl font-bold text-[#0D9488]">
                    {client.fullName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-[var(--page-text)]">
                      {client.fullName}
                    </h2>
                    <p className="truncate text-sm text-[var(--light-text-muted)]">
                      {client.fitnessGoal || "No goal set"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div
                    className="rounded-2xl border p-3"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--light-text-muted)]">
                      Email
                    </p>
                    <p className="mt-2 text-sm text-[var(--page-text)]">
                      {client.email}
                    </p>
                  </div>
                  <div
                    className="rounded-2xl border p-3"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--light-text-muted)]">
                      Phone
                    </p>
                    <p className="mt-2 text-sm text-[var(--page-text)]">
                      {client.phone || "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--light-text-muted)]">
                  <span>Status: {client.status}</span>
                  <span>Experience: {client.experienceLevel}</span>
                </div>
              </motion.button>
            ))}
            {clients.length === 0 && (
              <div
                className="rounded-3xl border bg-[var(--card-bg)] p-6 text-center text-sm text-[var(--light-text-muted)]"
                style={{ borderColor: "var(--card-border)" }}
              >
                No clients available. Add clients through storage or the coach
                dashboard.
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
