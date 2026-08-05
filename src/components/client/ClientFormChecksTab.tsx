import { useEffect, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Video, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { formatDateShort } from "@/lib/utils";
import { getClientFormChecks, type FormCheck } from "@/lib/formChecks";
import FormCheckReviewModal from "@/components/formchecks/FormCheckReviewModal";

interface ClientFormChecksTabProps {
  clientEmail: string;
}

/** Trainer view of a client's form-check submissions, with the review modal. */
export default function ClientFormChecksTab({ clientEmail }: ClientFormChecksTabProps) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [checks, setChecks] = useState<FormCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<FormCheck | null>(null);

  const refetch = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      setChecks(await getClientFormChecks(pid));
    } catch (err) {
      toast.error("Failed to load: " + (err instanceof Error ? err.message : "Unknown error"));
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("email", clientEmail)
        .maybeSingle();
      if (cancelled || !prof) {
        if (!cancelled) setLoading(false);
        return;
      }
      setProfileId(prof.id);
      setClientName(prof.full_name || clientEmail);
      await refetch(prof.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientEmail, refetch]);

  if (loading && !profileId) {
    return (
      <div className="flex items-center justify-center rounded-2xl border py-12" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--azfit-primary)" }} />
      </div>
    );
  }

  if (!profileId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border py-12" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <Video size={32} style={{ color: "var(--light-text-muted)" }} />
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--light-text-muted)" }}>
          No linked app account for this client yet
        </p>
      </div>
    );
  }

  return (
    <div>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-2xl border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }} />
          ))}
        </div>
      ) : checks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border py-12" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <Video size={32} style={{ color: "var(--light-text-muted)" }} />
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--light-text-muted)" }}>
            No form-check videos from this client yet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive({ ...item, ownerName: clientName, ownerEmail: clientEmail })}
              className="group overflow-hidden rounded-2xl border text-left transition hover:opacity-90"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
            >
              <div className="relative flex aspect-video items-center justify-center bg-slate-950">
                <Play className="h-10 w-10 text-slate-600 transition group-hover:text-[#00AEEF]" />
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    item.status === "reviewed" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {item.status === "reviewed" ? "Reviewed" : "Pending"}
                </span>
              </div>
              <div className="px-3 py-2.5">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--page-text)" }}>{item.exerciseName}</p>
                <p className="text-[11px]" style={{ color: "var(--light-text-muted)" }}>{formatDateShort(item.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {active && (
          <FormCheckReviewModal
            item={active}
            onClose={() => setActive(null)}
            onSaved={() => profileId && refetch(profileId)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
