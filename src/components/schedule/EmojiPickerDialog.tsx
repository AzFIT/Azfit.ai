// ═══════════════════════════════════════════════════════════════
// EmojiPickerDialog (Phase 68 Item 3b) — the completion-emoji editor.
// Text input (native emoji keyboard) + preset chips + 'None'.
// Validation is sanitizeEmojiInput (single grapheme or empty).
// ═══════════════════════════════════════════════════════════════

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EMOJI_PRESETS, sanitizeEmojiInput } from "@/lib/scheduleEmoji";

interface EmojiPickerDialogProps {
  open: boolean;
  current: string;
  onSave: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPickerDialog({ open, current, onSave, onClose }: EmojiPickerDialogProps) {
  const [value, setValue] = useState(current);
  const sanitized = sanitizeEmojiInput(value);
  const valid = value.trim() === "" || sanitized !== "";

  const save = () => {
    if (!valid) return;
    onSave(sanitizeEmojiInput(value));
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[var(--page-text)]">Completion emoji</h3>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[var(--light-text-muted)] hover:text-[var(--page-text)] hover:bg-[var(--page-bg)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-[var(--light-text-muted)] mb-2">
              Shown on a calendar day when every scheduled session is completed.
            </p>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="🔥"
              aria-label="Completion emoji input"
              className="bg-[var(--page-bg)] border-[var(--card-border)] text-[var(--page-text)] text-center text-xl h-11"
            />
            {!valid && (
              <p className="mt-1 text-[10px] font-medium text-[#EF4444]">One emoji only — anything else is stripped.</p>
            )}
            <div className="mt-3 flex items-center justify-center gap-2">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  onClick={() => setValue(e)}
                  aria-label={`Preset ${e}`}
                  className={`h-9 w-9 rounded-lg border text-lg transition-colors ${
                    value === e ? "border-[#00AEEF] bg-[#00AEEF]/10" : "border-[var(--card-border)] hover:border-[#00AEEF]/40"
                  }`}
                >
                  {e}
                </button>
              ))}
              <button
                onClick={() => setValue("")}
                className={`h-9 rounded-lg border px-2.5 text-[10px] font-semibold transition-colors ${
                  value.trim() === "" ? "border-[#00AEEF] bg-[#00AEEF]/10 text-[#00AEEF]" : "border-[var(--card-border)] text-[var(--light-text-muted)] hover:border-[#00AEEF]/40"
                }`}
              >
                None
              </button>
            </div>
            <Button onClick={save} disabled={!valid} className="mt-4 w-full bg-[#00AEEF] hover:opacity-90 text-white font-semibold disabled:opacity-50">
              Save
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
