/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ChatMessage } from './types';

interface ChatContextType {
  isOpen: boolean;
  messages: ChatMessage[];
  unreadCount: number;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  markRead: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY = 'azfit_chat_messages';

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [{
    id: 'welcome',
    role: 'assistant',
    text: "👋 Hey! I'm AzFIT AI. I can help you start workouts, log food, check progress, or navigate the app. What would you like to do?",
    timestamp: Date.now(),
    actions: [
      { label: '💪 Start Workout', type: 'navigate', payload: '/sheets' },
      { label: '🍎 Log Food', type: 'navigate', payload: '/nutrition' },
      { label: '📊 View Progress', type: 'navigate', payload: '/bioprint' },
      { label: '⚙️ Settings', type: 'navigate', payload: '/settings' },
    ],
  }];
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); // Keep last 50
  } catch { /* ignore */ }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [unreadCount, setUnreadCount] = useState(0);

  const openChat = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
  }, []);

  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setUnreadCount(0);
      return !prev;
    });
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, message];
      saveMessages(next);
      return next;
    });
    if (!isOpen && message.role === 'assistant') {
      setUnreadCount((c) => c + 1);
    }
  }, [isOpen]);

  const clearMessages = useCallback(() => {
    const welcome = loadMessages();
    setMessages(welcome);
    saveMessages(welcome);
  }, []);

  const markRead = useCallback(() => setUnreadCount(0), []);

  return (
    <ChatContext.Provider value={{
      isOpen, messages, unreadCount,
      openChat, closeChat, toggleChat, addMessage, clearMessages, markRead,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}
