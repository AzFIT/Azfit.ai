import { motion } from "framer-motion";
import type { Conversation } from "./types";

interface ConversationListProps {
  conversations: Conversation[];
  selectedPartnerId: string | null;
  onSelect: (partnerId: string) => void;
  loading?: boolean;
}

export default function ConversationList({
  conversations,
  selectedPartnerId,
  onSelect,
  loading,
}: ConversationListProps) {
  if (loading && conversations.length === 0) {
    return (
      <div className="flex-1 space-y-3 p-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl p-3 animate-pulse"
            style={{ backgroundColor: "var(--card-bg)" }}
          >
            <div className="h-11 w-11 shrink-0 rounded-full bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-slate-700" />
              <div className="h-3 w-full rounded bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(13,148,136,0.1)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--light-text-muted)" }}>
          No conversations yet
        </p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--light-text-muted)" }}>
          Messages will appear here when you start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv, i) => (
        <motion.button
          key={conv.partnerId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          onClick={() => onSelect(conv.partnerId)}
          className="flex w-full items-center gap-3 p-3 text-left transition-all duration-150 active:scale-[0.99]"
          style={{
            backgroundColor:
              selectedPartnerId === conv.partnerId
                ? "rgba(13, 148, 136, 0.08)"
                : "transparent",
            borderLeft:
              conv.unreadCount > 0
                ? "3px solid #0D9488"
                : "3px solid transparent",
          }}
          onMouseEnter={(e) => {
            if (selectedPartnerId !== conv.partnerId) {
              e.currentTarget.style.backgroundColor = "var(--light-elevated)";
            }
          }}
          onMouseLeave={(e) => {
            if (selectedPartnerId !== conv.partnerId) {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          {/* Avatar */}
          <div className="relative h-11 w-11 shrink-0">
            {conv.partnerAvatar ? (
              <img
                src={conv.partnerAvatar}
                alt={conv.partnerName}
                className="h-full w-full rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full text-sm font-bold"
              style={{
                backgroundColor: "var(--light-elevated)",
                color: "var(--azfit-primary)",
              }}
            >
              {conv.partnerInitials}
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span
                className="truncate text-sm font-semibold"
                style={{ color: "var(--page-text)" }}
              >
                {conv.partnerName}
              </span>
              <span
                className="shrink-0 text-[10px]"
                style={{ color: "var(--light-text-muted)" }}
              >
                {conv.lastMessageAt}
              </span>
            </div>
            <p
              className="truncate text-xs"
              style={{ color: "var(--light-text-secondary)" }}
            >
              {conv.lastMessage}
            </p>
          </div>

          {/* Unread Badge */}
          {conv.unreadCount > 0 && (
            <span
              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold"
              style={{
                backgroundColor: "#0D9488",
                color: "#FFFFFF",
              }}
            >
              {conv.unreadCount}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
