import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, StickyNote, Calendar, Pencil, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';
import type { Database } from '@/types/supabase';

type NoteRow = Database['public']['Tables']['client_notes']['Row'];

interface NotesTabProps {
  clientId: string; // clients.id — client_notes.client_id references clients(id)
}

export default function NotesTab({ clientId }: NotesTabProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotes((data as NoteRow[]) || []);
    } catch (err) {
      toast.error('Failed to load notes: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const content = newNote.trim();
    if (!content || !user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('client_notes')
        .insert({ client_id: clientId, trainer_id: user.id, note: content });
      if (error) throw error;
      toast.success('Note saved');
      setNewNote('');
      setIsAdding(false);
      await load();
    } catch (err) {
      toast.error('Failed to save note: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (noteId: string) => {
    const content = editDraft.trim();
    if (!content) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('client_notes')
        .update({ note: content, updated_at: new Date().toISOString() })
        .eq('id', noteId);
      if (error) throw error;
      toast.success('Note updated');
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error('Failed to update note: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    setConfirmDeleteId(null);
    try {
      const { error } = await supabase.from('client_notes').delete().eq('id', noteId);
      if (error) throw error;
      toast.success('Note deleted');
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      toast.error('Failed to delete note: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: privacy hint + Add */}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--light-text-muted)' }}>
          <Lock size={11} />
          Private to you — the client never sees these
        </span>
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
                placeholder="Write a private note about this client..."
                className="min-h-[100px] text-sm rounded-xl"
                style={{ backgroundColor: 'var(--light-elevated)', borderColor: 'var(--card-border)', color: 'var(--page-text)' }}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => { setIsAdding(false); setNewNote(''); }} className="rounded-xl">Cancel</Button>
                <Button size="sm" onClick={handleAdd} disabled={saving || !newNote.trim()} className="rounded-xl" style={{ backgroundColor: 'var(--azfit-primary)', color: '#fff' }}>
                  {saving ? 'Saving…' : 'Save Note'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border py-12" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <StickyNote size={32} style={{ color: 'var(--light-text-muted)' }} />
          <p className="mt-2 text-sm font-medium" style={{ color: 'var(--light-text-muted)' }}>No notes yet — private to you.</p>
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
              {editingId === note.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="min-h-[80px] text-sm rounded-xl"
                    style={{ backgroundColor: 'var(--light-elevated)', borderColor: 'var(--card-border)', color: 'var(--page-text)' }}
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="rounded-xl">Cancel</Button>
                    <Button size="sm" onClick={() => handleSaveEdit(note.id)} disabled={saving || !editDraft.trim()} className="rounded-xl" style={{ backgroundColor: 'var(--azfit-primary)', color: '#fff' }}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--page-text)' }}>{note.note}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Calendar size={10} style={{ color: 'var(--light-text-muted)' }} />
                      <span className="text-[10px]" style={{ color: 'var(--light-text-muted)' }}>
                        {formatDate(note.created_at)}
                        {note.updated_at !== note.created_at && ' (edited)'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingId(note.id); setEditDraft(note.note); }}
                      className="p-1.5 rounded-lg hover:opacity-80"
                      title="Edit note"
                    >
                      <Pencil size={14} style={{ color: 'var(--azfit-primary)' }} />
                    </button>
                    {confirmDeleteId === note.id ? (
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}
                      >
                        Confirm?
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(note.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50"
                        title="Delete note"
                      >
                        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
