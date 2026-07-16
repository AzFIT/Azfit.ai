import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useMessaging } from "@/components/messaging/useMessaging";
import ConversationList from "@/components/messaging/ConversationList";
import MessageThread from "@/components/messaging/MessageThread";
import MessageComposer from "@/components/messaging/MessageComposer";

/* ═══════════════════════════════════════════════════════════════════
   Messages Page — /messages
   Real-time trainer-client messaging.
   Mobile: list ↔ thread navigation. Desktop: side-by-side.
   ═══════════════════════════════════════════════════════════════════ */

export default function Messages() {
  const { user } = useAuth();
  const myId = user?.id || "";

  const {
    conversations,
    messages,
    selectedPartnerId,
    loading,
    sending,
    selectPartner,
    sendMessage,
  } = useMessaging();

  const selectedConversation = conversations.find(
    (c) => c.partnerId === selectedPartnerId
  );

  const [mobileView, setMobileView] = useState<"list" | "thread">("list");

  const handleSelect = (partnerId: string) => {
    selectPartner(partnerId);
    setMobileView("thread");
  };

  const handleBack = () => {
    selectPartner(null);
    setMobileView("list");
  };

  const handleSend = async (text: string) => {
    await sendMessage(text);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4 pb-20 lg:px-6 lg:pb-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-4"
      >
        <h1
          className="text-2xl font-bold tracking-tight lg:text-3xl"
          style={{ color: "var(--page-text)" }}
        >
          Messages
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--light-text-muted)" }}>
          Chat with your {user?.role === "client" ? "coach" : "clients"}
        </p>
      </motion.div>

      <div
        className="flex h-[calc(100dvh-12rem)] overflow-hidden rounded-2xl border lg:h-[calc(100dvh-14rem)]"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        {/* Left Panel - Conversation List */}
        <div
          className={`flex w-full flex-col border-r lg:w-[40%] ${
            mobileView === "thread" ? "hidden lg:flex" : "flex"
          }`}
          style={{ borderColor: "var(--card-border)" }}
        >
          <div className="border-b p-4" style={{ borderColor: "var(--card-border)" }}>
            <h3 className="text-base font-bold" style={{ color: "var(--page-text)" }}>
              Conversations
            </h3>
          </div>
          <ConversationList
            conversations={conversations}
            selectedPartnerId={selectedPartnerId}
            onSelect={handleSelect}
            loading={loading}
          />
        </div>

        {/* Right Panel - Thread */}
        <div
          className={`flex w-full flex-col lg:w-[60%] ${
            mobileView === "list" ? "hidden lg:flex" : "flex"
          }`}
        >
          {selectedPartnerId && selectedConversation ? (
            <>
              <MessageThread
                messages={messages}
                myId={myId}
                partnerName={selectedConversation.partnerName}
                partnerAvatar={selectedConversation.partnerAvatar}
                partnerInitials={selectedConversation.partnerInitials}
                onBack={handleBack}
              />
              <MessageComposer onSend={handleSend} disabled={sending} />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center">
              <div
                className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(13, 148, 136, 0.1)" }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0D9488"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--light-text-secondary)" }}>
                Select a conversation to start messaging
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
