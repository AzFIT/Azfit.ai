import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, StickyNote, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ClientNote } from '@/types/client';

interface NotesTabProps {
  notes: ClientNote[];
  onAddNote: (content: string) => void;
  onDeleteNote: (noteId: string) => void;
}

export default function NotesTab({ notes, onAddNote, onDeleteNote }: NotesTabProps) {
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (!newNote.trim()) return;
    onAddNote(newNote.trim());
    setNewNote('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Add Note */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          className="gap-1.5 rounded-xl"
          style={{ backgroundColor: 'var(--azfit-primary)', color: '#fff' }}
        >
          <Plus size={14} />
          {isAdding ? 'Cancel' : 'Add Note'}
        </Button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note about this client..."
                className="min-h-[100px] text-sm rounded-xl"
                style={{ backgroundColor: 'var(--light-elevated)', borderColor: 'var(--card-border)', color: 'var(--page-text)' }}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => { setIsAdding(false); setNewNote(''); }} className="rounded-xl">Cancel</Button>
                <Button size="sm" onClick={handleAdd} className="rounded-xl" style={{ backgroundColor: 'var(--azfit-primary)', color: '#fff' }}>Save Note</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border py-12" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <StickyNote size={32} style={{ color: 'var(--light-text-muted)' }} />
          <p className="mt-2 text-sm font-medium" style={{ color: 'var(--light-text-muted)' }}>No notes yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-4 group" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--page-text)' }}>{note.content}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Calendar size={10} style={{ color: 'var(--light-text-muted)' }} />
                    <span className="text-[10px]" style={{ color: 'var(--light-text-muted)' }}>
                      {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50"
                >
                  <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
