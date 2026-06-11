import { useState } from 'react';
import { Clock } from 'lucide-react';
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

interface BlockTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBlock: (event: CalendarEvent) => void;
}

const TIME_SLOTS = Array.from({ length: 33 }, (_, i) => {
  const h = Math.floor(i / 2) + 6;
  const m = i % 2 === 0 ? '00' : '30';
  return `${h.toString().padStart(2, '0')}:${m}`;
});

const REASONS = ['Personal', 'Out of Office', 'Lunch', 'Other'];

export function BlockTimeDialog({ open, onOpenChange, onBlock }: BlockTimeDialogProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [reason, setReason] = useState('Personal');
  const [note, setNote] = useState('');
  const [recurring, setRecurring] = useState(false);

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setStartTime('12:00');
    setEndTime('13:00');
    setReason('Personal');
    setNote('');
    setRecurring(false);
  };

  const handleBlock = () => {
    const event: CalendarEvent = {
      id: `evt-block-${Date.now()}`,
      title: `${reason} — Blocked`,
      date,
      startTime,
      endTime,
      type: 'blocked',
      description: note,
    };
    onBlock(event);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#F0F0F0]">
            <Clock className="h-5 w-5 text-[#64748B]" />
            Block Time
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
            <Label className="text-sm text-[#94A3B8]">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[#2A3447] bg-[#1A2235]">
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r} className="text-[#F0F0F0]">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm text-[#94A3B8]">Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional details..."
              rows={2}
              className="mt-1 border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={recurring}
              onCheckedChange={(v) => setRecurring(v as boolean)}
            />
            <Label className="text-sm text-[#94A3B8]">Recurring</Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2A3447] text-[#94A3B8]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleBlock}
            className="bg-[#64748B] text-white hover:bg-[#64748B]/80"
          >
            Block Time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
