import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CalendarEvent } from '@/types';

interface EditSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onSave: (id: string, updates: Partial<CalendarEvent>) => void;
  onCancelSession: (id: string) => void;
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

export function EditSessionDialog({
  open,
  onOpenChange,
  event,
  onSave,
  onCancelSession,
}: EditSessionDialogProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Initialize from event prop — dialog remounts when event changes via key
  const [title, setTitle] = useState(event?.title || '');
  const [date, setDate] = useState(event?.date || '');
  const [startTime, setStartTime] = useState(event?.startTime || '');
  const [endTime, setEndTime] = useState(event?.endTime || '');
  const [type, setType] = useState(event?.type || 'session');
  const [notes, setNotes] = useState(event?.description || '');

  if (!event) return null;

  const handleSave = () => {
    onSave(event.id, { title, date, startTime, endTime, type: type as CalendarEvent['type'], description: notes });
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancelSession(event.id);
    setShowCancelConfirm(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#F0F0F0]">Edit Session</DialogTitle>
        </DialogHeader>

        {showCancelConfirm ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-[#94A3B8]">
              Are you sure you want to cancel this session with{' '}
              <span className="font-medium text-[#F0F0F0]">{event.clientName || 'Unknown'}</span>{' '}
              on <span className="font-medium text-[#F0F0F0]">{date}</span>?
            </p>
            <div>
              <Label className="text-sm text-[#94A3B8]">Reason (optional)</Label>
              <Textarea
                placeholder="Reason for cancellation..."
                rows={2}
                className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCancelConfirm(false)}
                className="border-[#2A3447] text-[#94A3B8]"
              >
                Keep Session
              </Button>
              <Button
                onClick={handleCancel}
                className="bg-[#EF4444] text-white hover:bg-[#EF4444]/80"
              >
                Cancel Session
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-[#94A3B8]">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
              />
            </div>
            <div>
              <Label className="text-sm text-[#94A3B8]">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
              />
            </div>
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
            <div>
              <Label className="text-sm text-[#94A3B8]">Session Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CalendarEvent['type'])}>
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
                rows={3}
                className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCancelConfirm(true)}
                className="mr-auto border-[#EF444440] text-[#EF4444] hover:bg-[#EF444410]"
              >
                Cancel Session
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-[#2A3447] text-[#94A3B8]"
              >
                Close
              </Button>
              <Button
                onClick={handleSave}
                className="bg-[#00AEEF] text-white hover:bg-[#00BFFF]"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
