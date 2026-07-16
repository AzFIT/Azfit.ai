import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";

/* ═══════════════════════════════════════════════════════════════════
   MessagesTab — Coach dashboard tab
   Now redirects to the real /messages page.
   ═══════════════════════════════════════════════════════════════════ */

export default function MessagesTab() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(13, 148, 136, 0.1)" }}
      >
        <MessageSquare className="h-8 w-8" style={{ color: "var(--azfit-primary)" }} />
      </div>
      <h3
        className="text-lg font-semibold"
        style={{ color: "var(--page-text)" }}
      >
        Messaging has moved
      </h3>
      <p
        className="mt-2 max-w-sm text-center text-sm"
        style={{ color: "var(--light-text-muted)" }}
      >
        Real-time messaging is now available on the dedicated Messages page.
      </p>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/messages")}
        className="mt-6 flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white"
        style={{ backgroundColor: "var(--azfit-primary)" }}
      >
        Open Messages
        <ArrowRight className="h-4 w-4" />
      </motion.button>
    </motion.div>
  );
}
