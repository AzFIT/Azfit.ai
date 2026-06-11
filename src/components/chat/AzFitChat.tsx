 
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, X, User, Bot, ChevronRight } from 'lucide-react';
import { useChatContext } from './ChatContext';
import { classifyIntent, getPageContext } from './intentClassifier';
import { generateResponse } from './responseGenerator';
import type { ChatMessage, ChatAction } from './types';

export default function AzFitChat() {
  const { isOpen, messages, unreadCount, toggleChat, closeChat, addMessage } = useChatContext();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    const timeoutId = setTimeout(() => {
      const intentResult = classifyIntent(text);
      const currentPage = getPageContext(location.pathname);
      const response = generateResponse(text, {
        intentResult,
        currentPage: currentPage || undefined,
        messageHistory: messages,
      });

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: response.text,
        timestamp: Date.now(),
        actions: response.actions,
      };
      addMessage(assistantMsg);
      setIsTyping(false);
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [input, location.pathname, messages, addMessage]);

  const handleAction = useCallback((action: ChatAction) => {
    if (action.type === 'navigate') {
      navigate(action.payload);
      closeChat();
    } else if (action.type === 'suggest') {
      setInput(action.payload);
      inputRef.current?.focus();
    }
  }, [navigate, closeChat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: 'spring', stiffness: 260, damping: 20 }}
        onClick={toggleChat}
        className="fixed bottom-20 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-lg lg:bottom-6"
        style={{
          background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)',
          boxShadow: '0 4px 20px rgba(0, 174, 239, 0.4)',
        }}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <>
            <Sparkles className="h-6 w-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={closeChat}
            />

            {/* Panel */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[60] flex max-h-[85vh] flex-col rounded-t-2xl shadow-2xl lg:bottom-6 lg:right-6 lg:left-auto lg:h-[600px] lg:w-[400px] lg:rounded-2xl"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between border-b px-4 py-3"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}
                  >
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      AzFIT AI
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      Always here to help
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeChat}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-800"
                >
                  <X className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        msg.role === 'user'
                          ? 'bg-slate-700'
                          : ''
                      }`}
                      style={
                        msg.role === 'assistant'
                          ? { background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }
                          : undefined
                      }
                    >
                      {msg.role === 'user' ? (
                        <User className="h-3.5 w-3.5 text-slate-300" />
                      ) : (
                        <Bot className="h-3.5 w-3.5 text-white" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div className="max-w-[80%]">
                      <div
                        className="rounded-2xl px-3 py-2 text-sm"
                        style={{
                          backgroundColor: msg.role === 'user' ? '#0D9488' : 'var(--light-elevated)',
                          color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                          borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        }}
                      >
                        {msg.text}
                      </div>

                      {/* Actions */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.actions.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleAction(action)}
                              className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all hover:opacity-80"
                              style={{
                                backgroundColor: 'var(--light-elevated)',
                                color: 'var(--azfit-primary)',
                                border: '1px solid var(--card-border)',
                              }}
                            >
                              {action.label}
                              {action.type === 'navigate' && (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ background: 'linear-gradient(135deg, #00AEEF, #8B5CF6)' }}
                    >
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div
                      className="rounded-2xl px-3 py-2"
                      style={{
                        backgroundColor: 'var(--light-elevated)',
                        borderRadius: '16px 16px 16px 4px',
                      }}
                    >
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div
                className="border-t p-3"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything..."
                    className="flex-1 rounded-xl px-3 py-2 text-sm outline-none transition-colors"
                    style={{
                      backgroundColor: 'var(--light-elevated)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-all disabled:opacity-40"
                    style={{
                      background: input.trim() && !isTyping
                        ? 'linear-gradient(135deg, #00AEEF, #8B5CF6)'
                        : 'var(--light-elevated)',
                    }}
                  >
                    <Send className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
