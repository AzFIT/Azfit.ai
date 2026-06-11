import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, ChevronRight, Dumbbell } from 'lucide-react';
import { getSimilarExercises } from '@/lib/aiProgramGenerator';

interface ExerciseReplacerProps {
  isOpen: boolean;
  onClose: () => void;
  targetExercise: string;
  targetCategory: string;
  usedExercises: string[];
  onReplace: (newExercise: string) => void;
}

export function ExerciseReplacer({
  isOpen,
  onClose,
  targetExercise,
  targetCategory,
  usedExercises,
  onReplace,
}: ExerciseReplacerProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const alternatives = useMemo(() => {
    if (!isOpen) return [];
    return getSimilarExercises(targetExercise, targetCategory, new Set(usedExercises));
  }, [isOpen, targetExercise, targetCategory, usedExercises]);

  const handleReplace = (name: string) => {
    onReplace(name);
    setSelected(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#0B1120] border-t border-slate-700/50 rounded-t-3xl max-h-[75vh] overflow-hidden flex flex-col"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-600" />
            </div>

            <div className="px-5 pb-8 pt-2 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-[#00AEEF]" />
                    Replace Exercise
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">{targetExercise}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                    {targetCategory}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Alternatives List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {alternatives.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No alternatives found. Try adjusting your program constraints.
                  </div>
                ) : (
                  alternatives.map((alt, idx) => (
                    <button
                      key={alt.name}
                      onClick={() => handleReplace(alt.name)}
                      className={`w-full text-left p-3 rounded-xl border transition-all group
                        ${selected === alt.name
                          ? 'border-[#00AEEF]/50 bg-[#00AEEF]/10'
                          : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank / Crown */}
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                          {idx === 0 ? (
                            <Crown className="w-4 h-4 text-amber-400" />
                          ) : (
                            <span className="text-xs font-bold text-slate-500">{idx + 1}</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">
                              {alt.name}
                            </span>
                            {idx === 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                                Best Match
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-500">{alt.category}</span>
                            <span className="text-[10px] text-slate-600">•</span>
                            <span className="text-[10px] text-slate-500">{alt.reason}</span>
                          </div>
                        </div>

                        {/* Similarity Score */}
                        <div className="text-right shrink-0">
                          <div className={`text-sm font-bold ${
                            alt.similarityScore >= 80 ? 'text-emerald-400' :
                            alt.similarityScore >= 50 ? 'text-amber-400' :
                            'text-slate-400'
                          }`}>
                            {alt.similarityScore}%
                          </div>
                          <div className="text-[10px] text-slate-500">match</div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#00AEEF] transition-colors shrink-0" />
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Cancel */}
              <button
                onClick={onClose}
                className="mt-4 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
