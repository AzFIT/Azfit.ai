import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, ArrowLeft } from 'lucide-react';
import { conversations, type Conversation, type Message } from './data';

const quickReplies = ['Great work!', 'Check in tomorrow', 'Keep it up!', 'See you at session'];

function MessageBubble({ message }: { message: Message }) {
  const isCoach = message.sender === 'coach';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className="max-w-[75%] px-4 py-2.5 text-sm"
        style={{
          backgroundColor: isCoach ? '#0D9488' : 'var(--light-elevated)',
          color: isCoach ? '#FFFFFF' : 'var(--page-text)',
          borderRadius: isCoach ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        }}
      >
        {message.text}
        <div
          className="mt-1 text-right text-[10px]"
          style={{
            color: isCoach
              ? 'rgba(255,255,255,0.7)'
              : 'var(--light-text-muted)',
          }}
        >
          {message.timestamp}
        </div>
      </div>
    </motion.div>
  );
}

export default function MessagesTab() {
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat messages when selecting a conversation
  useEffect(() => {
    if (activeConv) {
      setChatMessages(activeConv.messages);
    }
  }, [activeConv]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    if (!inputText.trim() || !activeConv) return;
    const newMsg: Message = {
      id: Date.now(),
      sender: 'coach',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setInputText('');
  };

  const handleQuickReply = (text: string) => {
    if (!activeConv) return;
    const newMsg: Message = {
      id: Date.now(),
      sender: 'coach',
      text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setChatMessages((prev) => [...prev, newMsg]);
  };

  return (
    <div className="flex h-[calc(100dvh-12rem)] overflow-hidden rounded-2xl border lg:h-[calc(100dvh-14rem)]"
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
      }}
    >
      {/* Left Panel - Conversation List */}
      <div
        className={`flex w-full flex-col border-r lg:w-[40%] ${activeConv ? 'hidden lg:flex' : 'flex'}`}
        style={{ borderColor: 'var(--card-border)' }}
      >
        <div
          className="border-b p-4"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <h3
            className="text-base font-bold"
            style={{ color: 'var(--page-text)' }}
          >
            Messages
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv, i) => (
            <motion.button
              key={conv.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              onClick={() => setActiveConv(conv)}
              className="flex w-full items-center gap-3 p-3 text-left transition-all duration-150 active:scale-[0.99]"
              style={{
                backgroundColor:
                  activeConv?.id === conv.id
                    ? 'rgba(13, 148, 136, 0.08)'
                    : 'transparent',
                borderLeft:
                  conv.unread > 0
                    ? '3px solid #0D9488'
                    : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (activeConv?.id !== conv.id) {
                  e.currentTarget.style.backgroundColor = 'var(--light-elevated)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeConv?.id !== conv.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* Avatar */}
              <div className="relative h-11 w-11 shrink-0">
                <img
                  src={conv.clientAvatar}
                  alt={conv.clientName}
                  className="h-full w-full rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: 'var(--light-elevated)',
                    color: 'var(--azfit-primary)',
                  }}
                >
                  {conv.clientName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span
                    className="truncate text-sm font-semibold"
                    style={{ color: 'var(--page-text)' }}
                  >
                    {conv.clientName}
                  </span>
                  <span
                    className="shrink-0 text-[10px]"
                    style={{ color: 'var(--light-text-muted)' }}
                  >
                    {conv.time}
                  </span>
                </div>
                <p
                  className="truncate text-xs"
                  style={{ color: 'var(--light-text-secondary)' }}
                >
                  {conv.preview}
                </p>
              </div>

              {/* Unread Badge */}
              {conv.unread > 0 && (
                <span
                  className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                  style={{
                    backgroundColor: '#0D9488',
                    color: '#FFFFFF',
                  }}
                >
                  {conv.unread}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Right Panel - Chat */}
      <div
        className={`flex w-full flex-col lg:w-[60%] ${!activeConv ? 'hidden lg:flex' : 'flex'}`}
      >
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div
              className="flex items-center gap-3 border-b p-3"
              style={{ borderColor: 'var(--card-border)' }}
            >
              <button
                onClick={() => setActiveConv(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-[0.92] lg:hidden"
                style={{ color: 'var(--page-text)' }}
              >
                <ArrowLeft size={20} />
              </button>
              <div className="relative h-9 w-9">
                <img
                  src={activeConv.clientAvatar}
                  alt={activeConv.clientName}
                  className="h-full w-full rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div
                  className="absolute inset-0 flex items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--light-elevated)',
                    color: 'var(--azfit-primary)',
                  }}
                >
                  {activeConv.clientName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2"
                  style={{
                    backgroundColor: '#84CC16',
                    borderColor: 'var(--card-bg)',
                  }}
                />
              </div>
              <div>
                <div
                  className="text-sm font-semibold"
                  style={{ color: 'var(--page-text)' }}
                >
                  {activeConv.clientName}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: '#84CC16' }}
                >
                  Online
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 space-y-3 overflow-y-auto p-4"
              style={{ backgroundColor: 'var(--page-bg)' }}
            >
              {chatMessages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            <div
              className="border-t px-4 pt-2"
              style={{ borderColor: 'var(--card-border)' }}
            >
              <div className="flex gap-2 overflow-x-auto pb-2">
                {quickReplies.map((text) => (
                  <button
                    key={text}
                    onClick={() => handleQuickReply(text)}
                    className="shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all active:scale-[0.95]"
                    style={{
                      backgroundColor: 'rgba(13, 148, 136, 0.1)',
                      color: '#0D9488',
                    }}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div
              className="flex items-end gap-2 border-t p-3"
              style={{ borderColor: 'var(--card-border)' }}
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="max-h-[120px] min-h-[40px] flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm outline-none transition-all focus:border-[var(--azfit-primary)] focus:ring-[3px] focus:ring-[rgba(13,148,136,0.15)]"
                style={{
                  backgroundColor: 'var(--light-elevated)',
                  borderColor: 'var(--card-border)',
                  color: 'var(--page-text)',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-150 active:scale-[0.92] disabled:opacity-40"
                style={{
                  backgroundColor: '#0D9488',
                  color: '#FFFFFF',
                }}
              >
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex flex-1 flex-col items-center justify-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)' }}
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
            <p
              className="mt-3 text-sm font-medium"
              style={{ color: 'var(--light-text-secondary)' }}
            >
              Select a conversation to start messaging
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
