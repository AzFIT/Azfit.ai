import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CancelConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  date: string;
  onConfirm: (reason: string) => void;
}

const CANCEL_REASONS = [
  'Client request',
  'Trainer unavailable',
  'Rescheduled',
  'Other',
];

export function CancelConfirmDialog({
  open,
  onOpenChange,
  clientName,
  date,
  onConfirm,
}: CancelConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    onConfirm(reason || 'Other');
    setReason('');
    setNote('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-[#2A3447] bg-[#1A2235] text-[#F0F0F0]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-[#F0F0F0]">
            <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />
            Cancel Session
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-[#94A3B8]">
            Cancel session with <span className="font-medium text-[#F0F0F0]">{clientName}</span> on{' '}
            <span className="font-medium text-[#F0F0F0]">{date}</span>?
          </p>

          <div>
            <label className="mb-1 block text-sm text-[#94A3B8]">Reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="border-[#2A3447] bg-[#111827] text-[#F0F0F0]">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent className="border-[#2A3447] bg-[#1A2235]">
                {CANCEL_REASONS.map((r) => (
                  <SelectItem key={r} value={r} className="text-[#F0F0F0]">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-[#94A3B8]">Note (optional)</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional details..."
              rows={2}
              className="border-[#2A3447] bg-[#111827] text-[#F0F0F0]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-[#2A3447] text-[#94A3B8]"
          >
            Keep Session
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-[#F59E0B] text-white hover:bg-[#F59E0B]/80"
          >
            Cancel Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
