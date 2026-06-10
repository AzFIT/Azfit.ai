import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Dumbbell, Search, X } from 'lucide-react';
import { EXERCISE_CATEGORIES, getCategoryById, type ExerciseCategory } from '@/data/exerciseDatabase';

interface ExerciseSelectorProps {
  value: string;
  onChange: (exercise: string, categoryId: string) => void;
  categoryFilter?: string; // optional: restrict to specific category
  placeholder?: string;
  label?: string;
  className?: string;
}

export function ExerciseSelector({
  value,
  onChange,
  categoryFilter,
  placeholder = 'Select exercise...',
  label,
  className = '',
}: ExerciseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (categoryFilter) {
      const cat = getCategoryById(categoryFilter);
      return cat ? [cat] : EXERCISE_CATEGORIES;
    }
    return EXERCISE_CATEGORIES;
  }, [categoryFilter]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        exercises: cat.exercises.filter((e) => e.toLowerCase().includes(q)),
        alternatives: cat.alternatives.filter((e) => e.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.exercises.length > 0 || cat.alternatives.length > 0);
  }, [categories, searchQuery]);

  const handleSelect = (exercise: string, catId: string) => {
    onChange(exercise, catId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    onChange('', '');
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl
          border transition-all duration-200 text-left
          ${value
            ? 'border-teal-500/40 bg-teal-500/10 text-white'
            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
          }
        `}
      >
        <span className="flex items-center gap-2 truncate">
          <Dumbbell className="w-4 h-4 shrink-0 text-teal-400" />
          <span className="truncate">{value || placeholder}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="p-0.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-full min-w-[320px] max-h-[420px] overflow-y-auto
              bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50
              scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent"
          >
            {/* Search */}
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-3 z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search exercises..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                    text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Category Tabs */}
            {!categoryFilter && !searchQuery && (
              <div className="flex gap-1 p-2 overflow-x-auto scrollbar-none border-b border-slate-700/50">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors
                    ${selectedCategory === null
                      ? 'bg-teal-500/20 text-teal-300'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                  All
                </button>
                {EXERCISE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors
                      ${selectedCategory === cat.id
                        ? 'bg-teal-500/20 text-teal-300'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            {/* Exercise List */}
            <div className="p-2">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No exercises found
                </div>
              ) : (
                filteredCategories.map((cat) => {
                  if (selectedCategory && selectedCategory !== cat.id) return null;
                  return (
                    <div key={cat.id} className="mb-3 last:mb-0">
                      <div className="px-2 py-1.5 text-xs font-semibold text-teal-400 uppercase tracking-wider">
                        {cat.label}
                      </div>
                      {cat.exercises.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => handleSelect(ex, cat.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors
                            ${value === ex
                              ? 'bg-teal-500/20 text-teal-300'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                          {ex}
                        </button>
                      ))}
                      {cat.alternatives.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                            Alternatives
                          </div>
                          {cat.alternatives.map((ex) => (
                            <button
                              key={ex}
                              onClick={() => handleSelect(ex, cat.id)}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors
                                ${value === ex
                                  ? 'bg-teal-500/20 text-teal-300'
                                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                }`}
                            >
                              {ex}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
