import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, X, Bot, User, ChevronRight, ThumbsUp, ThumbsDown } from "lucide-react";
import { useNavigate } from "react-router";
import { useChatContext } from "../chat/ChatContext";
import { classifyIntent, getPageContext } from "../chat/intentClassifier";
import { generateResponse } from "../chat/responseGenerator";
import { tryHandleGuidedFlow } from "../chat/guidedFlows";
import type { ChatMessage, ChatAction, MessageContent } from "../chat/types";
import { ProgramCard } from "./ProgramCard";
import { ExerciseSwapCard } from "./ExerciseSwapCard";
import { QuickActionsBar } from "./QuickActionsBar";
import { useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { logChatMessage, logActionClick, submitFeedback } from "../chat/chatLogging";

/* ── Components ────────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "#00AEEF", animationDelay: "0ms" }} />
      <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "#00AEEF", animationDelay: "150ms" }} />
      <div className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: "#00AEEF", animationDelay: "300ms" }} />
    </div>
  );
}

function MessageFeedback({
  message,
  onFeedback,
}: {
  message: ChatMessage;
  onFeedback: (rating: 1 | -1) => void;
}) {
  if (message.role !== "assistant") return null;
  return (
    <div className="mt-1 flex items-center gap-1">
      <button
        onClick={() => onFeedback(1)}
        title="Helpful"
        className="rounded p-1 transition-colors hover:bg-slate-800"
        aria-label="Thumbs up"
      >
        <ThumbsUp
          className="h-3.5 w-3.5"
          style={{ color: message.feedback === 1 ? "#00AEEF" : "var(--text-muted)" }}
        />
      </button>
      <button
        onClick={() => onFeedback(-1)}
        title="Not helpful"
        className="rounded p-1 transition-colors hover:bg-slate-800"
        aria-label="Thumbs down"
      >
        <ThumbsDown
          className="h-3.5 w-3.5"
          style={{ color: message.feedback === -1 ? "#EF4444" : "var(--text-muted)" }}
        />
      </button>
    </div>
  );
}

function MessageBubble({
  message,
  onAction,
  onFeedback,
}: {
  message: ChatMessage;
  onAction: (action: ChatAction) => void;
  onFeedback: (rating: 1 | -1) => void;
}) {
  const isUser = message.role === "user";
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: isUser ? "var(--ai-violet)" : "#00AEEF",
        }}
      >
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            backgroundColor: isUser ? "var(--ai-violet)" : "var(--card-bg)",
            border: isUser ? "none" : "1px solid var(--card-border)",
            color: isUser ? "#fff" : "var(--text-primary)",
          }}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
        </div>

        {/* Rich Content */}
        {message.content?.type === "program" && (
          <ProgramCard
            content={message.content}
            onApply={() => navigate("/ai-program-builder")}
            onModify={() => navigate("/ai-program-builder")}
            onExport={() => {}}
          />
        )}
        {message.content?.type === "exercise_swap" && (
          <ExerciseSwapCard
            content={message.content}
            onApply={() => navigate("/ai-program-builder")}
            onUndo={() => navigate("/ai-program-builder")}
            onExplain={() => {}}
          />
        )}

        {/* Action Buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <button
                key={action.label}
                onClick={() => onAction(action)}
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all hover:opacity-80"
                style={{
                  borderColor: "var(--card-border)",
                  color: action.type === "apply" ? "#fff" : "var(--text-primary)",
                  backgroundColor: action.type === "apply" ? "#00AEEF" : "var(--card-bg)",
                }}
              >
                {action.label}
                {action.type === "navigate" && <ChevronRight className="h-3 w-3" />}
              </button>
            ))}
          </div>
        )}

        <MessageFeedback message={message} onFeedback={onFeedback} />
      </div>
    </motion.div>
  );
}

/* ── Main Interface ────────────────────────────────────── */

interface AIChatInterfaceProps {
  onClose?: () => void;
}

export function AIChatInterface({ onClose }: AIChatInterfaceProps) {
  const { messages, addMessage, updateMessage, clearMessages, pendingFlow, setPendingFlow } = useChatContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();

  const userRole = user?.role === "admin" ? "trainer" : user?.role;

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  // Cleanup pending response timer
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleFeedback = useCallback(
    async (message: ChatMessage, rating: 1 | -1) => {
      if (!message.dbId || !user?.id) return;
      const ok = await submitFeedback(message.dbId, user.id, rating);
      if (ok) updateMessage(message.id, { feedback: rating });
    },
    [user, updateMessage]
  );

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text || isTyping) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text,
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      setInput("");
      setIsTyping(true);
      logChatMessage(user?.id, "user", text);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        const flow = await tryHandleGuidedFlow(text, {
          userId: user?.id,
          userEmail: user?.email,
          userRole: userRole || "client",
          pendingFlow,
        });

        if (flow) {
          if (flow.pendingFlow !== undefined) setPendingFlow(flow.pendingFlow);

          const assistantMsg: ChatMessage = {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: flow.text,
            timestamp: Date.now(),
            actions: flow.actions,
          };
          addMessage(assistantMsg);
          setIsTyping(false);
          logChatMessage(user?.id, "assistant", flow.text).then((id) => {
            if (id) updateMessage(assistantMsg.id, { dbId: id });
          });
          return;
        }

        const intentResult = classifyIntent(text);
        const currentPage = getPageContext(location.pathname);
        const response = await generateResponse(text, {
          intentResult,
          currentPage: currentPage || undefined,
          userRole: userRole || "client",
          userId: user?.id,
          userEmail: user?.email,
          messageHistory: messages,
        });

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: response.text,
          timestamp: Date.now(),
          actions: response.actions,
          content: response.content as MessageContent | undefined,
        };
        addMessage(assistantMsg);
        setIsTyping(false);
        logChatMessage(user?.id, "assistant", response.text, { intent: intentResult.intent }).then((id) => {
          if (id) updateMessage(assistantMsg.id, { dbId: id });
        });
      }, 800);
    },
    [input, isTyping, location.pathname, messages, addMessage, user?.id, user?.email, userRole, pendingFlow, setPendingFlow, updateMessage]
  );

  const handleSend = useCallback(() => sendMessage(), [sendMessage]);

  const handleAction = useCallback(
    (action: ChatAction) => {
      logActionClick(user?.id, action);
      if (action.type === "navigate") {
        navigate(action.payload);
      } else if (action.type === "link") {
        window.open(action.payload, "_blank", "noopener,noreferrer");
      } else if (action.type === "suggest") {
        setInput(action.payload);
        inputRef.current?.focus();
      }
    },
    [navigate, user?.id]
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage]
  );

  return (
    <div className="flex h-[100dvh] flex-col" style={{ backgroundColor: "var(--page-bg)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, #00AEEF, var(--ai-violet))" }}
          >
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              AI Coaching Assistant
            </h1>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Context: All Clients • Personality: Balanced
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="rounded-lg px-2 py-1 text-[10px] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Clear
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--card-border)" }}
            >
              <X className="h-4 w-4" style={{ color: "var(--text-primary)" }} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onAction={handleAction}
              onFeedback={(rating) => handleFeedback(msg, rating)}
            />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div
        className="border-t px-4 py-3"
        style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
      >
        <div className="mx-auto max-w-3xl space-y-3">
          <QuickActionsBar onActionClick={handleQuickAction} />

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message... or use voice input"
                rows={1}
                className="w-full resize-none rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
                style={{
                  borderColor: "var(--card-border)",
                  color: "var(--text-primary)",
                  minHeight: "44px",
                  maxHeight: "120px",
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #00AEEF, var(--ai-violet))" }}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChatInterface;
