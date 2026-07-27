import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { motion } from "framer-motion";
import { Dumbbell, UserPlus, LogIn, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Invite() {
  const { trainerId } = useParams<{ trainerId: string }>();
  const navigate = useNavigate();
  const [trainerName, setTrainerName] = useState<string | null>(null);
  const idValid = !!trainerId && UUID_RE.test(trainerId);
  const [state, setState] = useState<"loading" | "valid" | "invalid">(
    idValid ? "loading" : "invalid",
  );

  useEffect(() => {
    if (!idValid) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_trainer_display_name", {
        p_trainer_id: trainerId as string,
      });
      if (cancelled) return;
      if (error || !data) {
        setState("invalid");
      } else {
        setTrainerName(data);
        setState("valid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idValid, trainerId]);

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4" style={{ backgroundColor: "#0F172A" }}>
      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src={`${import.meta.env.BASE_URL}images/bg-wireframe-gym.webp`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(rgba(11,17,32,0.86), rgba(11,17,32,0.92))" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md rounded-2xl border p-8 text-center"
        style={{ backgroundColor: "#1E293B", borderColor: "#475569" }}
      >
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(0,174,239,0.15)" }}
        >
          <Dumbbell size={32} style={{ color: "#00AEEF" }} />
        </div>

        {state === "loading" && (
          <div className="py-4">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "#00AEEF" }} />
          </div>
        )}

        {state === "invalid" && (
          <>
            <div className="flex justify-center mb-3">
              <AlertTriangle size={28} style={{ color: "#F59E0B" }} />
            </div>
            <h1 className="text-2xl font-bold text-white">This invite link is invalid</h1>
            <p className="mt-2 text-sm" style={{ color: "#94A3B8" }}>
              Ask your trainer to send you a fresh invite link.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 w-full rounded-lg py-3 text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "#0D9488", color: "#fff" }}
            >
              Go to AzFIT home
            </button>
          </>
        )}

        {state === "valid" && trainerName && (
          <>
            <h1 className="text-2xl font-bold text-white">
              Train with {trainerName}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "#94A3B8" }}>
              Your trainer invited you to AzFIT — track workouts, nutrition,
              check-ins and progress photos together in one place.
            </p>
            <button
              onClick={() => navigate(`/signup?trainer=${trainerId}`)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #00AEEF, #8B5CF6)" }}
            >
              <UserPlus size={16} />
              Create my account
            </button>
            <button
              onClick={() => navigate(`/login?trainer=${trainerId}`)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold transition-all hover:opacity-90"
              style={{ borderColor: "#475569", color: "#CBD5E1" }}
            >
              <LogIn size={16} />
              I already have an account
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
