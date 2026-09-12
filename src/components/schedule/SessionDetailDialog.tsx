/* ═══════════════════════════════════════════════════════════════
   SessionDetailDialog (Task 2 / Phase 84 / Phase 88) — tap target for
   any booked session. Read-only detail (client, date, start–end,
   status, notes) plus actions:
   · Edit (trainer, via the Book Session wizard) — Phase 88: disabled
     with an honest tooltip for past/completed sessions
   · Cancel (client, soft cancel — Phase 84 two-tap guard)
   · Cancel with reason (trainer, Phase 88 — required reason stored
     on sessions.cancel_reason; hard delete stays as a tertiary escape
     hatch for bogus rows)
   · Cancelled sessions render an honest state (Phase 88): who
     cancelled + the reason + "Book a new session" for the client —
     never presented as still on
   · Accept / Mark completed / Add to Calendar
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { CalendarPlus, Check, CheckCheck, Clock, MapPin, Pencil, Trash2, User, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { generateICS, downloadICS, icsFilename } from '@/lib/ics';
import type { CalendarEvent } from '@/types';

interface SessionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  /** Trainers get Edit + Cancel-with-reason (+ permanent delete); clients
   *  get soft Cancel — matches RLS. */
  isTrainer?: boolean;
  onEdit?: (event: CalendarEvent) => void;
  /** Hard delete (trainer, permanent — credits auto-refund) */
  onDelete?: (id: string) => void;
  /** Client soft cancel (no reason stored) */
  onCancel?: (id: string) => void;
  /** Phase 88: trainer soft cancel — reason is required and stored on the row */
  onCancelTrainer?: (id: string, reason: string) => void;
  /** Phase 88: client cancelled-state "Book a new session" affordance */
  onBookNew?: () => void;
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

type ConfirmMode = 'cancel' | 'delete' | null;

export function SessionDetailDialog({
  open,
  onOpenChange,
  event,
  isTrainer = false,
  onEdit,
  onDelete,
  onCancel,
  onCancelTrainer,
  onBookNew,
  onAccept,
  onMarkCompleted,
}: SessionDetailDialogProps) {
  const [confirming, setConfirming] = useState<ConfirmMode>(null);
  const [cancelReason, setCancelReason] = useState('');

  if (!event) return null;

  const isPast = new Date(`${event.date}T${event.endTime}`) < new Date();
  const isCancelled = event.status === 'cancelled';
  const isLiveStatus = event.status === 'scheduled' || event.status === 'requested';
  const canComplete =
    !!onMarkCompleted &&
    isPast &&
    (event.status === 'scheduled' || event.status === 'requested');
  const canAccept = !!onAccept && event.status === 'requested';

  // Phase 88 Item 2 guard: past/completed sessions are not editable —
  // the button renders DISABLED with an honest tooltip (no silent fail).
  const editable = !!onEdit && !isPast && isLiveStatus;

  const canCancelClient = !isTrainer && !!onCancel && isLiveStatus;
  const canCancelTrainer = isTrainer && !!onCancelTrainer && isLiveStatus;

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

  const trimmedReason = cancelReason.trim();
  const reasonValid = trimmedReason.length >= 3;

  const handleBookNew = () => {
    onOpenChange(false);
    onBookNew?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#F0F0F0]">{event.title}</DialogTitle>
        </DialogHeader>

        {confirming === 'cancel' ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-[#94A3B8]">
              {isTrainer
                ? `Cancel this session${event.clientName ? ` with ${event.clientName}` : ''} on ${prettyDate}? The client will see it as cancelled.`
                : `Cancel this session with ${event.clientName || 'your coach'} on ${prettyDate}? This notifies your trainer.`}
            </p>
            {/* Phase 88 Item 3: trainer cancels give a required reason —
                it is stored on the row and shown to the client. */}
            {isTrainer && (
              <div className="space-y-1.5">
                <label htmlFor="cancel-reason" className="text-xs font-medium text-[#94A3B8]">
                  Reason <span className="text-[#EF4444]">(required)</span> — shown to your client
                </label>
                <Textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Trainer ill — rescheduling"
                  rows={2}
                  className="border-[#2A3447] bg-[#111827] text-sm text-[#F0F0F0] placeholder:text-[#64748B]"
                />
                {!reasonValid && cancelReason.length > 0 && (
                  <p className="text-[11px] text-[#F59E0B]">
                    Please give a short reason (at least 3 characters).
                  </p>
                )}
              </div>
            )}
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
                onClick={() => { setConfirming(null); setCancelReason(''); }}
                className="border-[#2A3447] text-[#94A3B8]"
              >
                Keep Session
              </Button>
              <Button
                onClick={() => {
                  if (isTrainer) {
                    if (!reasonValid) return;
                    onCancelTrainer?.(event.id, trimmedReason);
                  } else {
                    onCancel?.(event.id);
                  }
                }}
                disabled={isTrainer && !reasonValid}
                className="bg-[#EF4444] text-white hover:bg-[#EF4444]/80"
              >
                Cancel Session
              </Button>
            </DialogFooter>
          </div>
        ) : confirming === 'delete' ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-[#94A3B8]">
              Delete this session permanently? This cannot be undone.
            </p>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirming(null)}
                className="border-[#2A3447] text-[#94A3B8]"
              >
                Keep Session
              </Button>
              <Button
                onClick={() => onDelete?.(event.id)}
                className="bg-[#EF4444] text-white hover:bg-[#EF4444]/80"
              >
                Delete Session
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Phase 88 Item 3: a cancelled session is never rendered as
                still on — honest who/why + a rebooking affordance. */}
            {isCancelled && (
              <div className="rounded-lg border border-[#94A3B8]/30 bg-[#94A3B8]/10 px-3 py-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-[#94A3B8]" />
                  <p className="text-sm font-semibold text-[#F0F0F0]">
                    {isTrainer ? 'This session is cancelled' : 'Cancelled by your trainer'}
                  </p>
                </div>
                {event.cancelReason ? (
                  <p className="mt-1.5 text-xs text-[#94A3B8]">
                    Reason: <span className="text-[#F0F0F0]">{event.cancelReason}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-[#94A3B8]">No reason was recorded.</p>
                )}
                {!isTrainer && onBookNew && (
                  <Button
                    onClick={handleBookNew}
                    className="mt-3 bg-[#00AEEF] text-white hover:bg-[#00BFFF]"
                  >
                    <CalendarPlus className="mr-1 h-4 w-4" />
                    Book a new session
                  </Button>
                )}
              </div>
            )}

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
              {/* Destructive (left): trainer = cancel-with-reason (soft,
                  Phase 88) + permanent delete tucked behind a second
                  confirm; client = soft cancel (Phase 84 guard) */}
              {canCancelTrainer && (
                <Button
                  variant="outline"
                  onClick={() => setConfirming('cancel')}
                  className="mr-auto border-[#EF444440] text-[#EF4444] hover:bg-[#EF444410]"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Cancel session
                </Button>
              )}
              {canCancelClient && (
                <Button
                  variant="outline"
                  onClick={() => setConfirming('cancel')}
                  className="mr-auto border-[#EF444440] text-[#EF4444] hover:bg-[#EF444410]"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Cancel session
                </Button>
              )}
              {isTrainer && !!onDelete && (
                <button
                  type="button"
                  onClick={() => setConfirming('delete')}
                  className="mr-auto text-[11px] text-[#64748B] underline underline-offset-2 hover:text-[#94A3B8]"
                >
                  or delete permanently
                </button>
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
              {!isCancelled && (
                <Button
                  variant="outline"
                  onClick={handleAddToCalendar}
                  className="border-[var(--azfit-primary)]/50 bg-transparent text-[var(--azfit-primary)] hover:bg-[var(--azfit-primary)]/10"
                  title="Download .ics"
                >
                  <CalendarPlus className="mr-1 h-4 w-4" />
                  Add to Calendar
                </Button>
              )}
              {isTrainer && onEdit && (
                <Button
                  onClick={() => editable && onEdit(event)}
                  disabled={!editable}
                  title={
                    editable
                      ? undefined
                      : isPast
                        ? 'Past sessions cannot be edited'
                        : 'Completed or cancelled sessions cannot be edited'
                  }
                  className="bg-[#00AEEF] text-white hover:bg-[#00BFFF] disabled:cursor-not-allowed disabled:opacity-40"
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
