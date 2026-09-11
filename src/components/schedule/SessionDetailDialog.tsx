/* ═══════════════════════════════════════════════════════════════
   SessionDetailDialog (Task 2) — tap target for any booked session.
   Read-only detail (client, date, start–end, status, notes) plus
   actions: Edit (via the Book Session wizard), Delete (trainer, hard
   delete with confirm), Cancel (client, soft cancel), Accept /
   Mark completed / Add to Calendar — migrated from EditSessionDialog.
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { CalendarPlus, Check, CheckCheck, Clock, MapPin, Pencil, Trash2, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { generateICS, downloadICS, icsFilename } from '@/lib/ics';
import type { CalendarEvent } from '@/types';

interface SessionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  /** Trainers get Edit + Delete; clients get Cancel (soft) — matches RLS. */
  isTrainer?: boolean;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
  onCancel?: (id: string) => void;
  /** requested → accept (status='scheduled') */
  onAccept?: (id: string) => void;
  /** scheduled/requested + past → mark completed */
  onMarkCompleted?: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#00AEEF',
  completed: '#22C55E',
  requested: '#F59E0B',
  cancelled: '#94A3B8',
};

export function SessionDetailDialog({
  open,
  onOpenChange,
  event,
  isTrainer = false,
  onEdit,
  onDelete,
  onCancel,
  onAccept,
  onMarkCompleted,
}: SessionDetailDialogProps) {
  const [confirming, setConfirming] = useState(false);

  if (!event) return null;

  const isPast = new Date(`${event.date}T${event.endTime}`) < new Date();
  const canComplete =
    !!onMarkCompleted &&
    isPast &&
    (event.status === 'scheduled' || event.status === 'requested');
  const canAccept = !!onAccept && event.status === 'requested';
  const destructiveLabel = isTrainer ? 'Delete' : 'Cancel session';
  const destructiveHandler = isTrainer ? onDelete : onCancel;

  const prettyDate = new Date(`${event.date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleAddToCalendar = () => {
    const ics = generateICS({
      id: event.id,
      title: event.title,
      startsAt: new Date(`${event.date}T${event.startTime}`).toISOString(),
      endsAt: new Date(`${event.date}T${event.endTime}`).toISOString(),
      location: event.location,
      notes: event.description,
    });
    downloadICS(ics, icsFilename(new Date(`${event.date}T${event.startTime}`).toISOString()));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#F0F0F0]">{event.title}</DialogTitle>
        </DialogHeader>

        {confirming ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-[#94A3B8]">
              {isTrainer
                ? 'Delete this session? This cannot be undone.'
                : `Cancel this session with ${event.clientName || 'your coach'} on ${prettyDate}? This notifies your trainer.`}
            </p>
            {/* Phase 84 Item 3: honest short-notice note (no policy
                enforcement — cancel stays allowed after confirm) */}
            {!isTrainer && new Date(`${event.date}T${event.startTime}`).getTime() - new Date().getTime() < 24 * 3600 * 1000 && (
              <p className="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 text-[11px] font-medium text-[#F59E0B]">
                This session is less than 24h away — your trainer will be notified.
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirming(false)}
                className="border-[#2A3447] text-[#94A3B8]"
              >
                Keep Session
              </Button>
              <Button
                onClick={() => destructiveHandler?.(event.id)}
                className="bg-[#EF4444] text-white hover:bg-[#EF4444]/80"
              >
                {isTrainer ? 'Delete Session' : 'Cancel Session'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[#F0F0F0]">
                <User className="h-4 w-4 text-[#00AEEF]" />
                <span className="font-medium">{event.clientName || 'Unknown'}</span>
                {event.status && (
                  <span
                    className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                    style={{
                      backgroundColor: `${STATUS_COLORS[event.status] || '#94A3B8'}20`,
                      color: STATUS_COLORS[event.status] || '#94A3B8',
                    }}
                  >
                    {event.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[#94A3B8]">
                <CalendarPlus className="h-4 w-4" />
                {prettyDate}
              </div>
              <div className="flex items-center gap-2 text-[#94A3B8]">
                <Clock className="h-4 w-4" />
                {event.startTime} – {event.endTime}
              </div>
              {event.location && (
                <div className="flex items-center gap-2 text-[#94A3B8]">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </div>
              )}
              {event.description && (
                <p className="rounded-lg border border-[#2A3447] bg-[#111827] px-3 py-2 text-xs text-[#94A3B8]">
                  {event.description}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2">
              {destructiveHandler && (
                <Button
                  variant="outline"
                  onClick={() => setConfirming(true)}
                  className="mr-auto border-[#EF444440] text-[#EF4444] hover:bg-[#EF444410]"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  {destructiveLabel}
                </Button>
              )}
              {canAccept && (
                <Button
                  onClick={() => onAccept!(event.id)}
                  className="bg-emerald-500 text-white hover:bg-emerald-500/80"
                >
                  <Check className="mr-1 h-4 w-4" />
                  Accept
                </Button>
              )}
              {canComplete && (
                <Button
                  onClick={() => onMarkCompleted!(event.id)}
                  className="bg-emerald-600 text-white hover:bg-emerald-600/80"
                >
                  <CheckCheck className="mr-1 h-4 w-4" />
                  Mark completed
                </Button>
              )}
              {/* Phase 84 Item 4: reads as an ACTIVE secondary action —
                  brand-token border + text instead of the greyed
                  'disabled' look (the dialog is the documented
                  always-navy surface; tokens resolve correctly on it) */}
              <Button
                variant="outline"
                onClick={handleAddToCalendar}
                className="border-[var(--azfit-primary)]/50 bg-transparent text-[var(--azfit-primary)] hover:bg-[var(--azfit-primary)]/10"
                title="Download .ics"
              >
                <CalendarPlus className="mr-1 h-4 w-4" />
                Add to Calendar
              </Button>
              {isTrainer && onEdit && (
                <Button
                  onClick={() => onEdit(event)}
                  className="bg-[#00AEEF] text-white hover:bg-[#00BFFF]"
                >
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
