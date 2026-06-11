import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, User, Ban, StickyNote, Repeat, X } from 'lucide-react';

interface CellContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  date: string;
  time: string;
  onBookClient: () => void;
  onNewClient: () => void;
  onBlockTime: () => void;
  onQuickNote: () => void;
  onRepeatWeekly: () => void;
}

export function CellContextMenu({
  isOpen,
  onClose,
  position,
  date,
  time,
  onBookClient,
  onNewClient,
  onBlockTime,
  onQuickNote,
  onRepeatWeekly,
}: CellContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleQuickNote = () => {
    if (!showNoteInput) {
      setShowNoteInput(true);
      return;
    }
    if (noteText.trim()) {
      onQuickNote();
      setNoteText('');
      setShowNoteInput(false);
      onClose();
    }
  };

  const menuItems = [
    { icon: User, label: 'Book Client', action: () => { onBookClient(); onClose(); }, color: 'text-[#00AEEF]' },
    { icon: UserPlus, label: 'New Client', action: () => { onNewClient(); onClose(); }, color: 'text-emerald-400' },
    { icon: Ban, label: 'Block Time', action: () => { onBlockTime(); onClose(); }, color: 'text-red-400' },
    { icon: StickyNote, label: showNoteInput ? 'Save Note' : 'Quick Note', action: handleQuickNote, color: 'text-amber-400' },
    { icon: Repeat, label: 'Repeat Weekly', action: () => { onRepeatWeekly(); onClose(); }, color: 'text-violet-400' },
  ];

  // Adjust position to keep menu in viewport
  const adjustedX = Math.min(position.x, window.innerWidth - 220);
  const adjustedY = Math.min(position.y, window.innerHeight - 280);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          style={{ left: adjustedX, top: adjustedY }}
          className="fixed z-50 w-56 bg-[#0B1120] border border-slate-700/50 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              {date} • {time}
            </span>
            <button onClick={onClose} className="p-0.5 rounded hover:bg-slate-800 text-slate-500">
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Note Input */}
          <AnimatePresence>
            {showNoteInput && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-slate-800">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    autoFocus
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Menu Items */}
          <div className="py-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/50 transition-colors"
              >
                <item.icon className={`w-4 h-4 ${item.color}`} />
                {item.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
