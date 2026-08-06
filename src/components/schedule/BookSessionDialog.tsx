import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, ChevronRight, User, CheckCircle } from 'lucide-react';
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
import type { CalendarEvent } from '@/types';

interface BookSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBook: (event: CalendarEvent, recurringCount: number) => void;
  isTrainer?: boolean;
  clients: { id: string; name: string; avatar?: string }[];
  initialDate?: string;
  /** When provided, the client is preselected and locked (booking from a
   * client's profile is always for that client). Default unchanged. */
  initialClientId?: string;
  /** Phase 50: session-package credit state for the selected client */
  credits?: { remaining: number; total: number } | null;
  /** Phase 50: start-time containment check vs the trainer's availability
   * template (windows + blocked dates). Only called when a template exists. */
  availabilityCheck?: (date: string, startTime: string) => boolean;
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
}: BookSessionDialogProps) {
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState(initialClientId || '');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [sessionType, setSessionType] = useState('session');
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState(4);

  const selectedClient = clients.find((c) => c.id === clientId);

  const canProceed = useMemo(() => {
    if (step === 1) return clientId !== '';
    if (step === 2) return date !== '' && startTime !== '' && endTime !== '';
    if (step === 3) return true;
    return true;
  }, [step, clientId, date, startTime, endTime]);

  const resetForm = () => {
    setStep(1);
    setClientId('');
    setDate(new Date().toISOString().split('T')[0]);
    setStartTime('09:00');
    setEndTime('10:00');
    setSessionType('session');
    setNotes('');
    setRecurring(false);
    setRecurringCount(4);
  };

  const handleBook = () => {
    const event: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: selectedClient ? `PT with ${selectedClient.name}` : 'New Session',
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
    resetForm();
    onOpenChange(false);
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#F0F0F0]">
            <CalendarPlus className="h-5 w-5 text-[#00AEEF]" />
            Book Session
          </DialogTitle>
        </DialogHeader>

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
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => { if (!initialClientId) setClientId(client.id); }}
                    disabled={!!initialClientId}
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                      clientId === client.id
                        ? 'border-[#00AEEF40] bg-[#00AEEF15]'
                        : 'border-[#2A3447] bg-[#111827] hover:border-[#00AEEF20]'
                    } ${initialClientId ? 'cursor-default opacity-90' : ''}`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00AEEF20]">
                      <User className="h-4 w-4 text-[#00AEEF]" />
                    </div>
                    <span className="text-sm font-medium text-[#F0F0F0]">{client.name}</span>
                    {clientId === client.id && <CheckCircle className="ml-auto h-4 w-4 text-[#00AEEF]" />}
                  </button>
                ))}
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
              {/* Phase 50: outside-availability hint (never a hard block) */}
              {availabilityCheck && date && startTime && !availabilityCheck(date, startTime) && (
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
                  <Label className="text-sm text-[#94A3B8]">End Time</Label>
                  <Select value={endTime} onValueChange={setEndTime}>
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
              {isTrainer && (
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
                  <span className="text-[#94A3B8]">Client</span>
                  <span className="font-medium text-[#F0F0F0]">{selectedClient?.name}</span>
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
                {/* Phase 50: package credits after this booking (warn, never block) */}
                {credits && (
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
          {step > 1 ? (
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
