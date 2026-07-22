import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Conversation, Message, PartnerProfile } from "./types";

/* ═══════════════════════════════════════════════════════════════════
   useMessaging — Real-time trainer-client messaging hook
   ═══════════════════════════════════════════════════════════════════ */

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function displayName(profile: PartnerProfile | null): string {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  const email = profile?.email?.trim();
  if (email) return email.split("@")[0] || email;
  return "Unknown";
}

export function useMessaging() {
  const { user } = useAuth();
  const myId = user?.id;
  const isTrainer = user?.role === "admin" || user?.role === "trainer";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /* ── Fetch conversations ─────────────────────────────────────────── */
  const fetchConversations = useCallback(async () => {
    if (!myId) return;
    setLoading(true);

    try {
      // Fetch all messages involving me
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by partner
      const partnerMap = new Map<string, { messages: Message[]; profile: PartnerProfile | null }>();

      for (const raw of msgs || []) {
        const msg: Message = {
          id: raw.id,
          senderId: raw.sender_id,
          receiverId: raw.receiver_id,
          content: raw.content,
          readAt: raw.read_at,
          createdAt: raw.created_at,
        };
        const partnerId = msg.senderId === myId ? msg.receiverId : msg.senderId;
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, { messages: [], profile: null });
        }
        partnerMap.get(partnerId)!.messages.push(msg);
      }

      // Fetch partner profiles
      const partnerIds = Array.from(partnerMap.keys());
      if (partnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, email")
          .in("id", partnerIds);

        for (const p of profiles || []) {
          const entry = partnerMap.get(p.id);
          if (entry) entry.profile = p;
        }
      }

      // Build conversation list
      const convs: Conversation[] = [];
      let unread = 0;

      for (const [partnerId, entry] of partnerMap) {
        const latest = entry.messages[0]; // already sorted desc
        const unreadCount = entry.messages.filter(
          (m) => m.receiverId === myId && m.readAt === null
        ).length;
        unread += unreadCount;

        const profile = entry.profile;
        const name = displayName(profile);
        convs.push({
          partnerId,
          partnerName: name,
          partnerAvatar: profile?.avatar_url || null,
          partnerInitials: getInitials(name === "Unknown" ? null : name),
          lastMessage: latest?.content || "",
          lastMessageAt: latest?.createdAt || "",
          unreadCount,
        });
      }

      // Sort by latest message
      convs.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

      setConversations(convs);
      setTotalUnread(unread);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [myId]);

  /* ── Fetch thread messages ─────────────────────────────────────── */
  const fetchThread = useCallback(async (partnerId: string) => {
    if (!myId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${myId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${myId})`
        )
        .order("created_at", { ascending: true });

      if (error) throw error;

      const threadMessages: Message[] = (data || []).map((raw) => ({
        id: raw.id,
        senderId: raw.sender_id,
        receiverId: raw.receiver_id,
        content: raw.content,
        readAt: raw.read_at,
        createdAt: raw.created_at,
      }));

      setMessages(threadMessages);
    } catch (err) {
      console.error("Failed to fetch thread:", err);
    } finally {
      setLoading(false);
    }
  }, [myId]);

  /* ── Send message ──────────────────────────────────────────────── */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!myId || !selectedPartnerId || !content.trim()) return false;
      setSending(true);

      try {
        const { error } = await supabase.from("messages").insert({
          sender_id: myId,
          receiver_id: selectedPartnerId,
          content: content.trim(),
        });

        if (error) throw error;

        // Optimistically append
        const optimistic: Message = {
          id: `temp-${Date.now()}`,
          senderId: myId,
          receiverId: selectedPartnerId,
          content: content.trim(),
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);
        await fetchConversations();
        return true;
      } catch (err) {
        console.error("Failed to send message:", err);
        toast.error("Failed to send message");
        return false;
      } finally {
        setSending(false);
      }
    },
    [myId, selectedPartnerId, fetchConversations]
  );

  /* ── Mark as read ──────────────────────────────────────────────── */
  const markAsRead = useCallback(
    async (partnerId: string) => {
      if (!myId) return;

      try {
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("receiver_id", myId)
          .eq("sender_id", partnerId)
          .is("read_at", null);

        // Update local state
        setMessages((prev) =>
          prev.map((m) =>
            m.receiverId === myId && m.senderId === partnerId && m.readAt === null
              ? { ...m, readAt: new Date().toISOString() }
              : m
          )
        );
        await fetchConversations();
      } catch (err) {
        console.error("Failed to mark as read:", err);
      }
    },
    [myId, fetchConversations]
  );

  /* ── Realtime subscription ─────────────────────────────────────── */
  useEffect(() => {
    if (!myId) return;

    fetchConversations();

    const channel = supabase
      .channel(`messages:${myId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${myId}`,
        },
        (payload) => {
          const newMsg: Message = {
            id: payload.new.id,
            senderId: payload.new.sender_id,
            receiverId: payload.new.receiver_id,
            content: payload.new.content,
            readAt: payload.new.read_at,
            createdAt: payload.new.created_at,
          };

          // If thread is open, append message
          if (selectedPartnerId === newMsg.senderId) {
            setMessages((prev) => [...prev, newMsg]);
            markAsRead(newMsg.senderId);
          } else {
            // Show toast for new message
            toast.info("New message received", {
              description: newMsg.content.slice(0, 60) + (newMsg.content.length > 60 ? "..." : ""),
              action: {
                label: "Open",
                onClick: () => setSelectedPartnerId(newMsg.senderId),
              },
            });
          }

          fetchConversations();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [myId, selectedPartnerId, fetchConversations, markAsRead]);

  /* ── Select partner ────────────────────────────────────────────── */
  const selectPartner = useCallback(
    (partnerId: string | null) => {
      setSelectedPartnerId(partnerId);
      if (partnerId && myId) {
        fetchThread(partnerId);
        markAsRead(partnerId);
      } else {
        setMessages([]);
      }
    },
    [myId, fetchThread, markAsRead]
  );

  return {
    conversations,
    messages,
    selectedPartnerId,
    loading,
    sending,
    totalUnread,
    isTrainer,
    selectPartner,
    sendMessage,
    markAsRead,
    fetchConversations,
  };
}
