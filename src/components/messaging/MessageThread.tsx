import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import type { Message } from "./types";

interface MessageThreadProps {
  messages: Message[];
  myId: string;
  partnerName: string;
  partnerAvatar: string | null;
  partnerInitials: string;
  onBack?: () => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessageThread({
  messages,
  myId,
  partnerName,
  partnerAvatar,
  partnerInitials,
  onBack,
}: MessageThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      {/* Chat Header */}
      <div
        className="flex items-center gap-3 border-b p-3"
        style={{ borderColor: "var(--card-border)" }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-[0.92] lg:hidden"
            style={{ color: "var(--page-text)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="relative h-9 w-9">
          {partnerAvatar ? (
            <img
              src={partnerAvatar}
              alt={partnerName}
              className="h-full w-full rounded-full object-cover"
            />
          ) : null}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full text-xs font-bold"
            style={{
              backgroundColor: "var(--light-elevated)",
              color: "var(--azfit-primary)",
            }}
          >
            {partnerInitials}
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--page-text)" }}>
            {partnerName}
          </div>
          <div className="text-[11px]" style={{ color: "#84CC16" }}>
            Online
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 space-y-3 overflow-y-auto p-4"
        style={{ backgroundColor: "var(--page-bg)" }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm" style={{ color: "var(--light-text-muted)" }}>
              Start the conversation
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === myId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[75%] px-4 py-2.5 text-sm"
                  style={{
                    backgroundColor: isMe ? "#0D9488" : "var(--light-elevated)",
                    color: isMe ? "#FFFFFF" : "var(--page-text)",
                    borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  }}
                >
                  {msg.content}
                  <div
                    className="mt-1 flex items-center justify-end gap-1 text-right text-[10px]"
                    style={{
                      color: isMe ? "rgba(255,255,255,0.7)" : "var(--light-text-muted)",
                    }}
                  >
                    {formatTime(msg.createdAt)}
                    {isMe && msg.readAt && (
                      <span className="ml-1">• Read</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </>
  );
}
