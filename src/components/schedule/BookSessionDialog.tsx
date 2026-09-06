import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, ChevronRight, User, CheckCircle, Search } from 'lucide-react';
import { filterClients, groupClients, clientStatusLabel } from '@/lib/clientSearch';
import {
  endTimeFromDuration,
  durationFromTimes,
  nearestDurationOption,
  DURATION_OPTIONS,
  DEFAULT_DURATION_MIN,
} from '@/lib/sessionDuration';
import { eventTypeToWizardType, wizardTypeToEventType } from '@/lib/sessionUpdate';
import { saveDraft, loadDraft, clearDraft } from '@/lib/draftStore';
import DraftBanner from '@/components/DraftBanner';

/** Task 6: single in-flight booking draft (the wizard is a modal). */
const BOOK_DRAFT_KEY = 'book-session';
interface BookDraftData {
  step: number;
  clientId: string;
  date: string;
  startTime: string;
  durationMin: number;
  sessionType: string;
  notes: string;
  title: string;
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateKeyLocal } from '@/lib/utils';
import type { CalendarEvent } from '@/types';

interface BookSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBook: (event: CalendarEvent, recurringCount: number) => void;
  isTrainer?: boolean;
  /** Phase 73 Item 2b: email/status power the searchable combobox
   * (filter + status chips). Optional — older callers pass id+name only. */
  clients: { id: string; name: string; avatar?: string; email?: string; status?: string }[];
  initialDate?: string;
  /** When provided, the client is preselected and locked (booking from a
   * client's profile is always for that client). Default unchanged. */
  initialClientId?: string;
  /** Phase 50: session-package credit state for the selected client */
  credits?: { remaining: number; total: number } | null;
  /** Phase 50: start-time containment check vs the trainer's availability
   * template (windows + blocked dates). Only called when a template exists. */
  availabilityCheck?: (date: string, startTime: string) => boolean;
  /** Task 2: when set, the wizard edits this existing session instead of
   * booking a new one (starts at the date/time step, client locked). */
  editingEvent?: CalendarEvent | null;
  /** Task 2: edit-mode submit — receives the id + the edited event. */
  onUpdate?: (id: string, event: CalendarEvent) => void;
}

const SESSION_TYPES = [
  { value: 'session', label: 'PT Session' },
  { value: 'reminder', label: 'Assessment' },
  { value: 'blocked', label: 'Consultation' },
  { value: 'returning', label: 'Check-in' },
];

const TIME_SLOTS = Array.from({ length: 33 }, (_, i) => {
  const h = Math.floor(i / 2) + 6;
  const m = i % 2 === 0 ? '00' : '30';
  return `${h.toString().padStart(2, '0')}:${m}`;
});

export function BookSessionDialog({
  open,
  onOpenChange,
  onBook,
  isTrainer = false,
  clients,
  initialDate,
  initialClientId,
  credits,
  availabilityCheck,
  editingEvent,
  onUpdate,
}: BookSessionDialogProps) {
  const isEdit = !!editingEvent;
  const firstStep = isEdit ? 2 : 1; // edit mode skips client selection
  // Task 2: edit-mode prefill happens via useState initializers — parents
  // remount the dialog with key={editingEvent.id} (repo pattern: no
  // setState-in-effect).
  const [step, setStep] = useState(editingEvent ? 2 : 1);
  const [clientId, setClientId] = useState(editingEvent?.clientId || initialClientId || '');
  const [date, setDate] = useState(
    editingEvent?.date || initialDate || formatDateKeyLocal(new Date()),
  );
  const [startTime, setStartTime] = useState(editingEvent?.startTime || '09:00');
  // Task 1: duration chips replace the End Time dropdown — end is DERIVED
  const [durationMin, setDurationMin] = useState<number>(
    editingEvent
      ? nearestDurationOption(durationFromTimes(editingEvent.startTime, editingEvent.endTime))
      : DEFAULT_DURATION_MIN,
  );
  const [sessionType, setSessionType] = useState(
    editingEvent ? eventTypeToWizardType(editingEvent.type) : 'session',
  );
  const [notes, setNotes] = useState(editingEvent?.description || '');
  const [recurring, setRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState(4);

  // Phase 73 Item 2b: searchable client combobox (step 1)
  const [clientQuery, setClientQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const visibleClients = useMemo(() => {
    const g = groupClients(filterClients(clients, clientQuery));
    return { ...g, flat: [...g.active, ...g.others] };
  }, [clients, clientQuery]);

  // Phase 73 Item 2c: editable session title, auto-filled "<Client> PT"
  // until the trainer types their own (titleTouched).
  const [title, setTitle] = useState(() => {
    if (editingEvent?.title) return editingEvent.title;
    const locked = initialClientId ? clients.find((c) => c.id === initialClientId) : null;
    return locked ? `${locked.name} PT` : '';
  });
  const [titleTouched, setTitleTouched] = useState(false);

  const pickClient = (id: string) => {
    if (initialClientId) return; // locked when booking from a client profile
    setClientId(id);
    if (!titleTouched) {
      const c = clients.find((x) => x.id === id);
      if (c) setTitle(`${c.name} PT`);
    }
  };

  const onClientSearchKeyDown = (e: React.KeyboardEvent) => {
    const n = visibleClients.flat.length;
    if (n === 0) return;
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = Math.min(highlightIdx + 1, n - 1);
    if (e.key === 'ArrowUp') next = Math.max(highlightIdx - 1, 0);
    if (e.key === 'Enter') {
      e.preventDefault();
      const c = visibleClients.flat[highlightIdx];
      if (c) pickClient(c.id);
      return;
    }
    if (next !== null) {
      e.preventDefault();
      setHighlightIdx(next);
      listRef.current
        ?.querySelector(`[data-idx="${next}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  };

  // Task 6: draft restore — checked when the dialog opens (create mode only;
  // edit mode always prefills from the row being edited). `dismissed` resets
  // via resetForm() on close, so the banner re-evaluates on the next open.
  const [draftHandled, setDraftHandled] = useState(false);
  const draftInfo = useMemo(
    () => (open && !isEdit && !draftHandled ? loadDraft<BookDraftData>(BOOK_DRAFT_KEY) : null),
    [open, isEdit, draftHandled],
  );

  // Task 6: debounced autosave while the wizard has real input
  useEffect(() => {
    if (!open || isEdit) return;
    const pristine =
      step === 1 && !clientId && startTime === '09:00' && durationMin === DEFAULT_DURATION_MIN &&
      sessionType === 'session' && notes === '';
    if (pristine) return;
    saveDraft(BOOK_DRAFT_KEY, { step, clientId, date, startTime, durationMin, sessionType, notes, title });
  }, [open, isEdit, step, clientId, date, startTime, durationMin, sessionType, notes, title]);

  const resumeDraft = () => {
    const d = loadDraft<BookDraftData>(BOOK_DRAFT_KEY);
    if (d) {
      setStep(d.data.step);
      setClientId(d.data.clientId);
      setDate(d.data.date);
      setStartTime(d.data.startTime);
      setDurationMin(d.data.durationMin);
      setSessionType(d.data.sessionType);
      setNotes(d.data.notes);
      setTitle(d.data.title ?? '');
      if (d.data.title) setTitleTouched(true);
    }
    setDraftHandled(true);
  };
  const discardDraft = () => {
    clearDraft(BOOK_DRAFT_KEY);
    setDraftHandled(true);
  };

  const endTime = endTimeFromDuration(startTime, durationMin);

  const selectedClient = clients.find((c) => c.id === clientId);

  // Availability: the derived END must also fit the coach's window.
  // NOTE: Phase 50 shipped this as an amber hint only; the current brief
  // upgrades it to a hard block (Task 1) — documented in PROGRESS.
  const outsideAvailability = useMemo(() => {
    if (!availabilityCheck || !date || !startTime) return false;
    return !availabilityCheck(date, startTime) || !availabilityCheck(date, endTime);
  }, [availabilityCheck, date, startTime, endTime]);

  const canProceed = useMemo(() => {
    if (step === 1) return clientId !== '';
    if (step === 2) return date !== '' && startTime !== '' && endTime !== '' && !outsideAvailability;
    if (step === 3) return true;
    return true;
  }, [step, clientId, date, startTime, endTime, outsideAvailability]);

  const resetForm = () => {
    setStep(1);
    setClientId('');
    setDate(formatDateKeyLocal(new Date()));
    setStartTime('09:00');
    setDurationMin(DEFAULT_DURATION_MIN);
    setSessionType('session');
    setNotes('');
    setTitle('');
    setTitleTouched(false);
    setClientQuery('');
    setHighlightIdx(0);
    setRecurring(false);
    setRecurringCount(4);
    setDraftHandled(false);
  };

  const handleBook = () => {
    const event: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: title.trim() || (selectedClient ? `${selectedClient.name} PT` : 'New Session'), // Task 4 / Phase 73: editable "{ClientName} PT"
      date,
      startTime,
      endTime,
      type: sessionType as CalendarEvent['type'],
      clientId,
      clientName: selectedClient?.name,
      description: notes,
      location: null,
    };
    onBook(event, isTrainer && recurring ? recurringCount : 1);
    clearDraft(BOOK_DRAFT_KEY); // Task 6: booked — the draft's job is done
    resetForm();
    onOpenChange(false);
  };

  // Task 2: edit-mode submit — UPDATE the existing row (no new booking)
  const handleUpdate = () => {
    if (!editingEvent || !onUpdate) return;
    onUpdate(editingEvent.id, {
      ...editingEvent,
      title: title.trim() || editingEvent.title,
      date,
      startTime,
      endTime,
      type: wizardTypeToEventType(sessionType),
      clientId,
      clientName: selectedClient?.name ?? editingEvent.clientName,
      description: notes,
    });
    resetForm();
    onOpenChange(false);
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > firstStep) setStep(step - 1);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#F0F0F0]">
            <CalendarPlus className="h-5 w-5 text-[#00AEEF]" />
            {isEdit ? 'Edit Session' : 'Book Session'}
          </DialogTitle>
        </DialogHeader>

        {/* Task 6: unfinished-booking restore prompt */}
        {draftInfo && (
          <DraftBanner savedAt={draftInfo.savedAt} onResume={resumeDraft} onDiscard={discardDraft} />
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 w-2 rounded-full transition-colors ${
                s === step ? 'bg-[#00AEEF]' : s < step ? 'bg-[#00AEEF60]' : 'bg-[#2A3447]'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="text-sm text-[#94A3B8]">
                {initialClientId ? 'Booking for this client' : 'Select a client for this session'}
              </div>
              {/* Phase 73 Item 2b: searchable combobox (client-side filter on
                  the loaded roster; keyboard: ↑/↓ move, Enter selects) */}
              {!initialClientId && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <Input
                    value={clientQuery}
                    onChange={(e) => { setClientQuery(e.target.value); setHighlightIdx(0); }}
                    onKeyDown={onClientSearchKeyDown}
                    placeholder="Search by name or email…"
                    aria-label="Search clients"
                    className="border-[#2A3447] bg-[#111827] pl-9 text-[#F0F0F0] placeholder:text-[#64748B]"
                  />
                </div>
              )}
              <div ref={listRef} className="max-h-64 space-y-1 overflow-y-auto">
                {visibleClients.active.length > 0 && !initialClientId && (
                  <p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Active</p>
                )}
                {visibleClients.active.map((client, i) => {
                  const flatIdx = i;
                  return (
                    <button
                      key={client.id}
                      data-idx={flatIdx}
                      onClick={() => pickClient(client.id)}
                      disabled={!!initialClientId}
                      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                        clientId === client.id
                          ? 'border-[#00AEEF40] bg-[#00AEEF15]'
                          : highlightIdx === flatIdx && !initialClientId
                            ? 'border-[#00AEEF60] bg-[#111827]'
                            : 'border-[#2A3447] bg-[#111827] hover:border-[#00AEEF20]'
                      } ${initialClientId ? 'cursor-default opacity-90' : ''}`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00AEEF20]">
                        <User className="h-4 w-4 text-[#00AEEF]" />
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#F0F0F0]">{client.name}</span>
                        {client.email && (
                          <span className="block truncate text-[10px] text-[#64748B]">{client.email}</span>
                        )}
                      </span>
                      <span className="shrink-0 rounded-full border border-[#2A3447] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#84CC16]">
                        {clientStatusLabel(client.status)}
                      </span>
                      {clientId === client.id && <CheckCircle className="h-4 w-4 shrink-0 text-[#00AEEF]" />}
                    </button>
                  );
                })}
                {visibleClients.others.length > 0 && (
                  <>
                    {!initialClientId && (
                      <p className="px-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Other</p>
                    )}
                    {visibleClients.others.map((client, i) => {
                      const flatIdx = visibleClients.active.length + i;
                      return (
                        <button
                          key={client.id}
                          data-idx={flatIdx}
                          onClick={() => pickClient(client.id)}
                          disabled={!!initialClientId}
                          className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                            clientId === client.id
                              ? 'border-[#00AEEF40] bg-[#00AEEF15]'
                              : highlightIdx === flatIdx && !initialClientId
                                ? 'border-[#00AEEF60] bg-[#111827]'
                                : 'border-[#2A3447] bg-[#111827] hover:border-[#00AEEF20]'
                          } ${initialClientId ? 'cursor-default opacity-90' : ''}`}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00AEEF20]">
                            <User className="h-4 w-4 text-[#00AEEF]" />
                          </div>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[#F0F0F0]">{client.name}</span>
                            {client.email && (
                              <span className="block truncate text-[10px] text-[#64748B]">{client.email}</span>
                            )}
                          </span>
                          <span className="shrink-0 rounded-full border border-[#2A3447] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">
                            {clientStatusLabel(client.status)}
                          </span>
                          {clientId === client.id && <CheckCircle className="h-4 w-4 shrink-0 text-[#00AEEF]" />}
                        </button>
                      );
                    })}
                  </>
                )}
                {visibleClients.flat.length === 0 && (
                  <p className="py-6 text-center text-xs text-[#64748B]">
                    No clients match “{clientQuery}”
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div>
                <Label className="text-sm text-[#94A3B8]">Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
                />
              </div>
              {/* Availability: start AND derived end must fit the template */}
              {outsideAvailability && (
                <div className="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 text-[11px] font-medium text-[#F59E0B]">
                  Outside your availability template
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-[#94A3B8]">Start Time</Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#2A3447] bg-[#1A2235]">
                      {TIME_SLOTS.map((t) => (
                        <SelectItem key={t} value={t} className="text-[#F0F0F0]">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-[#94A3B8]">Duration</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {DURATION_OPTIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDurationMin(d)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                          durationMin === d
                            ? 'border-[#00AEEF] bg-[#00AEEF]/15 text-[#00AEEF]'
                            : 'border-[#2A3447] bg-[#111827] text-[#94A3B8] hover:border-[#00AEEF40]'
                        }`}
                      >
                        {d}m
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-[#94A3B8]">
                    Ends <span className="font-bold text-[#F0F0F0]">{endTime}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Phase 73 Item 2c: auto-fills "<ClientName> PT" from the
                  picked client; stays editable (typing locks it in). */}
              <div>
                <Label className="text-sm text-[#94A3B8]">Session Title</Label>
                <Input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
                  placeholder={selectedClient ? `${selectedClient.name} PT` : 'Session title'}
                  className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
                />
              </div>
              <div>
                <Label className="text-sm text-[#94A3B8]">Session Type</Label>
                <Select value={sessionType} onValueChange={setSessionType}>
                  <SelectTrigger className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#2A3447] bg-[#1A2235]">
                    {SESSION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-[#F0F0F0]">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-[#94A3B8]">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Session focus, goals..."
                  rows={3}
                  className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
                />
              </div>
              {isTrainer && !isEdit && (
                <div className="space-y-3 rounded-lg border border-[#2A3447]/50 bg-[#111827]/50 p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={recurring}
                      onCheckedChange={(v) => setRecurring(v as boolean)}
                    />
                    <Label className="text-sm text-[#94A3B8]">Repeat weekly</Label>
                  </div>
                  {recurring && (
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-[#94A3B8]">Occurrences</Label>
                      <Select
                        value={recurringCount.toString()}
                        onValueChange={(v) => setRecurringCount(parseInt(v, 10))}
                      >
                        <SelectTrigger className="w-24 border-[#2A3447] bg-[#111827] text-[#F0F0F0] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-[#2A3447] bg-[#1A2235]">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={n.toString()} className="text-[#F0F0F0] text-xs">
                              {n} week{n > 1 ? 's' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 rounded-lg border border-[#2A3447] bg-[#111827] p-4"
            >
              <h3 className="text-sm font-semibold text-[#F0F0F0]">Booking Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Title</span>
                  <span className="max-w-[200px] truncate font-medium text-[#F0F0F0]">
                    {title.trim() || (selectedClient ? `${selectedClient.name} PT` : 'New Session')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Client</span>
                  <span className="font-medium text-[#F0F0F0]">
                    {selectedClient?.name ?? (isEdit ? editingEvent?.clientName : undefined)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Date</span>
                  <span className="font-medium text-[#F0F0F0]">{date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Time</span>
                  <span className="font-medium text-[#F0F0F0]">{startTime} - {endTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Type</span>
                  <span className="font-medium text-[#F0F0F0]">
                    {SESSION_TYPES.find((t) => t.value === sessionType)?.label}
                  </span>
                </div>
                {recurring && isTrainer && (
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Repeat</span>
                    <span className="font-medium text-[#F0F0F0]">{recurringCount} weeks</span>
                  </div>
                )}
                {notes && (
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Notes</span>
                    <span className="max-w-[200px] truncate font-medium text-[#F0F0F0]">{notes}</span>
                  </div>
                )}
                {/* Phase 50: package credits after this booking (warn, never
                    block). Hidden in edit mode — the credit is already consumed. */}
                {credits && !isEdit && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#94A3B8]">Credits</span>
                    <span
                      className="font-medium"
                      style={{
                        color:
                          credits.remaining - 1 <= 0
                            ? "#EF4444"
                            : credits.remaining - 1 === 1
                              ? "#F59E0B"
                              : "#F0F0F0",
                      }}
                    >
                      {credits.remaining - 1 <= 0
                        ? "No credits left after this booking"
                        : credits.remaining - 1 === 1
                          ? "Last credit — prompt renewal?"
                          : `${credits.remaining - 1} of ${credits.total} remaining after this booking`}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter className="gap-2">
          {step > firstStep ? (
            <Button variant="outline" onClick={handleBack} className="border-[#2A3447] text-[#94A3B8]">
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#2A3447] text-[#94A3B8]">
              Cancel
            </Button>
          )}
          {step < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="bg-[#00AEEF] text-white hover:bg-[#00BFFF]"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : isEdit ? (
            <Button onClick={handleUpdate} className="bg-[#00AEEF] text-white hover:bg-[#00BFFF]">
              <CalendarPlus className="mr-1 h-4 w-4" /> Save Changes
            </Button>
          ) : (
            <Button onClick={handleBook} className="bg-[#00AEEF] text-white hover:bg-[#00BFFF]">
              <CalendarPlus className="mr-1 h-4 w-4" /> Book Session
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
