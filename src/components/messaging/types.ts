export interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  partnerInitials: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

export interface PartnerProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}
