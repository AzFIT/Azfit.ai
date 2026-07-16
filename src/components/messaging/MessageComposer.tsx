import { useState } from "react";
import { Send } from "lucide-react";

interface MessageComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  quickReplies?: string[];
}

const defaultQuickReplies = ["Great work!", "Check in tomorrow", "Keep it up!", "See you at session"];

export default function MessageComposer({
  onSend,
  disabled,
  quickReplies = defaultQuickReplies,
}: MessageComposerProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };

  const handleQuickReply = (reply: string) => {
    if (disabled) return;
    onSend(reply);
  };

  return (
    <>
      {/* Quick Replies */}
      <div className="border-t px-4 pt-2" style={{ borderColor: "var(--card-border)" }}>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              onClick={() => handleQuickReply(reply)}
              className="shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all active:scale-[0.95]"
              style={{
                backgroundColor: "rgba(13, 148, 136, 0.1)",
                color: "#0D9488",
              }}
            >
              {reply}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 border-t p-3" style={{ borderColor: "var(--card-border)" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          rows={1}
          disabled={disabled}
          className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm outline-none transition-all focus:border-[var(--azfit-primary)] focus:ring-[3px] focus:ring-[rgba(13,148,136,0.15)] disabled:opacity-50"
          style={{
            backgroundColor: "var(--light-elevated)",
            borderColor: "var(--card-border)",
            color: "var(--page-text)",
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-150 active:scale-[0.92] disabled:opacity-40"
          style={{
            backgroundColor: "#0D9488",
            color: "#FFFFFF",
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </>
  );
}
