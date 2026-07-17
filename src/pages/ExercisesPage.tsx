import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Play, X, Dumbbell, ChevronDown, AlertTriangle, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface Exercise {
  ExerciseID: string;
  Name: string;
  MuscleGroup: string;
  Equipment: string;
  Difficulty: string;
  Type: string;
  VideoURL: string;
  Description: string;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|\/shorts\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getYouTubeThumbnail(url: string): string {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
}

function getYouTubeEmbed(url: string): string {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : '';
}

function generateSafetyNotes(exercise: Exercise): string {
  const notes: Record<string, string> = {
    'Barbell Back Squat': 'Keep core braced throughout. Do not round lower back. Use safety bars when training heavy.',
    'Romanian Deadlift': 'Maintain neutral spine. Do not hyperextend at lockout. Stop if hamstring strain is felt.',
    'Bench Press': 'Use spotter for heavy sets. Keep feet planted. Do not bounce bar off chest.',
    'Overhead Press': 'Avoid excessive lumbar arch. Brace abs. Do not use leg drive unless specified.',
    'Pull-Up': 'Full range of motion. Control descent. Avoid swinging or kipping unless specified.',
    'Barbell Row': 'Keep back flat. Pull to lower chest/upper abs. Avoid excessive momentum.',
    'Front Squat': 'Elbows must stay high. Core tight. Stop if wrist/elbow pain occurs.',
    'Incline Dumbbell Press': 'Control dumbbells on descent. Do not drop from top position.',
  };
  return (
    notes[exercise.Name] ||
    `Perform with controlled tempo. Use appropriate weight for ${exercise.Difficulty} level. Ensure proper warm-up before attempting.`
  );
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case 'Beginner':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' };
    case 'Intermediate':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' };
    case 'Advanced':
      return { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20' };
    default:
      return { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20' };
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'Compound':
      return { bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20' };
    case 'Isolation':
      return { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/20' };
    case 'Olympic':
      return { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20' };
    case 'Plyo':
      return { bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-500/20' };
    case 'Isometric':
      return { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/20' };
    default:
      return { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20' };
  }
}

function getMuscleColor(muscle: string) {
  if (muscle.includes('Chest')) return { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/20' };
  if (muscle.includes('Back')) return { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20' };
  if (muscle.includes('Quads') || muscle.includes('Leg')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' };
  if (muscle.includes('Hamstrings')) return { bg: 'bg-lime-500/10', text: 'text-lime-600 dark:text-lime-400', border: 'border-lime-500/20' };
  if (muscle.includes('Shoulders')) return { bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/20' };
  if (muscle.includes('Biceps') || muscle.includes('Triceps')) return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' };
  if (muscle.includes('Core') || muscle.includes('Abs')) return { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/20' };
  return { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/20' };
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors min-w-[140px]',
          'bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--text-primary)]',
          'hover:border-[#00AEEF]'
        )}
      >
        <span className="text-[var(--text-muted)] text-xs">{label}</span>
        <span className="font-medium truncate">{value}</span>
        <ChevronDown size={14} className={cn('ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto"
            >
              <button
                onClick={() => {
                  onChange('All');
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-sm transition-colors',
                  value === 'All' ? 'bg-[#00AEEF]/10 text-[#00AEEF]' : 'text-[var(--text-primary)] hover:bg-[var(--card-border)]'
                )}
              >
                All
              </button>
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm transition-colors',
                    value === opt ? 'bg-[#00AEEF]/10 text-[#00AEEF]' : 'text-[var(--text-primary)] hover:bg-[var(--card-border)]'
                  )}
                >
                  {opt}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExerciseCard({
  exercise,
  index,
  onPlay,
}: {
  exercise: Exercise;
  index: number;
  onPlay: (ex: Exercise) => void;
}) {
  const [showSafety, setShowSafety] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const diffColor = getDifficultyColor(exercise.Difficulty);
  const typeColor = getTypeColor(exercise.Type);
  const muscleColor = getMuscleColor(exercise.MuscleGroup);
  const thumb = getYouTubeThumbnail(exercise.VideoURL);
  const safetyNotes = generateSafetyNotes(exercise);
  const descTooLong = exercise.Description.length > 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, delay: index * 0.02, ease: [0.16, 1, 0.3, 1] }}
      layout
      className={cn(
        'bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden',
        'flex flex-col transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,174,239,0.08)]'
      )}
    >
      {/* Video Thumbnail */}
      <div className="relative aspect-video bg-[#0A0A0A] group cursor-pointer" onClick={() => onPlay(exercise)}>
        {thumb ? (
          <img
            src={thumb}
            alt={exercise.Name}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[var(--page-bg)]">
            <Dumbbell size={32} className="text-[var(--text-muted)]" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 group-hover:bg-[#00AEEF]/80 transition-all duration-200">
            <Play size={20} className="text-white ml-0.5" fill="white" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-[var(--text-primary)] font-semibold text-sm mb-2.5">{exercise.Name}</h3>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          <span
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
              muscleColor.bg,
              muscleColor.text,
              muscleColor.border
            )}
          >
            {exercise.MuscleGroup}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
              diffColor.bg,
              diffColor.text,
              diffColor.border
            )}
          >
            {exercise.Difficulty}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
              typeColor.bg,
              typeColor.text,
              typeColor.border
            )}
          >
            {exercise.Type}
          </span>
        </div>

        {/* Equipment */}
        <div className="flex items-center gap-1.5 text-[var(--text-muted)] mb-2">
          <Dumbbell size={12} />
          <span className="text-[11px]">{exercise.Equipment}</span>
        </div>

        {/* Description */}
        <p className="text-[var(--text-muted)] text-xs leading-relaxed mb-2 flex-1">
          {showFullDesc ? exercise.Description : exercise.Description.slice(0, 80)}
          {descTooLong && !showFullDesc && '...'}
        </p>
        {descTooLong && (
          <button
            onClick={() => setShowFullDesc(!showFullDesc)}
            className="text-[#00AEEF] text-xs font-medium hover:underline mb-2 text-left"
          >
            {showFullDesc ? 'Show less' : 'Read more'}
          </button>
        )}

        {/* Safety Notes Toggle */}
        <button
          onClick={() => setShowSafety(!showSafety)}
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium transition-colors mt-auto',
            showSafety ? 'text-amber-500' : 'text-[var(--text-muted)] hover:text-amber-500'
          )}
        >
          <AlertTriangle size={12} />
          {showSafety ? 'Hide safety notes' : 'Show safety notes'}
        </button>
        <AnimatePresence>
          {showSafety && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 p-2.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">{safetyNotes}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function VideoModal({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  if (!exercise) return null;
  const embedUrl = getYouTubeEmbed(exercise.VideoURL);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden w-full max-w-3xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border)]">
            <div>
              <h3 className="text-[var(--text-primary)] font-semibold text-sm">{exercise.Name}</h3>
              <p className="text-[var(--text-muted)] text-xs">
                {exercise.MuscleGroup} &middot; {exercise.Difficulty}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-border)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Video */}
          <div className="aspect-video bg-black">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={exercise.Name}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">Video not available</div>
            )}
          </div>

          {/* Info */}
          <div className="p-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--card-border)]">
                {exercise.Equipment}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--card-border)]">
                {exercise.Type}
              </span>
            </div>
            <p className="text-[var(--text-muted)] text-xs leading-relaxed">{exercise.Description}</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [equipmentFilter, setEquipmentFilter] = useState('All');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [playingExercise, setPlayingExercise] = useState<Exercise | null>(null);

  // Fetch data
  useEffect(() => {
    fetch('./exercises_db.json')
      .then((r) => r.json())
      .then((data: Exercise[]) => {
        setExercises(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Derive filter options
  const muscleOptions = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((e) => set.add(e.MuscleGroup));
    return Array.from(set).sort();
  }, [exercises]);

  const equipmentOptions = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((e) => set.add(e.Equipment));
    return Array.from(set).sort();
  }, [exercises]);

  const difficultyOptions = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((e) => set.add(e.Difficulty));
    return Array.from(set).sort();
  }, [exercises]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((e) => set.add(e.Type));
    return Array.from(set).sort();
  }, [exercises]);

  // Filter
  const filtered = useMemo(() => {
    let result = exercises;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.Name.toLowerCase().includes(q) ||
          e.MuscleGroup.toLowerCase().includes(q) ||
          e.Equipment.toLowerCase().includes(q) ||
          e.Description.toLowerCase().includes(q)
      );
    }
    if (muscleFilter !== 'All') result = result.filter((e) => e.MuscleGroup === muscleFilter);
    if (equipmentFilter !== 'All') result = result.filter((e) => e.Equipment === equipmentFilter);
    if (difficultyFilter !== 'All') result = result.filter((e) => e.Difficulty === difficultyFilter);
    if (typeFilter !== 'All') result = result.filter((e) => e.Type === typeFilter);
    return result;
  }, [exercises, searchQuery, muscleFilter, equipmentFilter, difficultyFilter, typeFilter]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setMuscleFilter('All');
    setEquipmentFilter('All');
    setDifficultyFilter('All');
    setTypeFilter('All');
  }, []);

  const hasFilters = searchQuery || muscleFilter !== 'All' || equipmentFilter !== 'All' || difficultyFilter !== 'All' || typeFilter !== 'All';

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6" style={{ backgroundColor: 'var(--page-bg)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Exercise Library</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {filtered.length} of {exercises.length} exercises
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            type="text"
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm border outline-none transition-colors bg-[var(--card-bg)] border-[var(--card-border)] text-[var(--text-primary)] focus:border-[#00AEEF]"
          />
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-[var(--text-muted)] mr-1" />
          <FilterDropdown label="Muscle" value={muscleFilter} options={muscleOptions} onChange={setMuscleFilter} />
          <FilterDropdown label="Equipment" value={equipmentFilter} options={equipmentOptions} onChange={setEquipmentFilter} />
          <FilterDropdown label="Difficulty" value={difficultyFilter} options={difficultyOptions} onChange={setDifficultyFilter} />
          <FilterDropdown label="Type" value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-[#00AEEF] hover:underline font-medium ml-1">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-[var(--card-border)]" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-[var(--card-border)] rounded w-3/4" />
                <div className="flex gap-1">
                  <div className="h-4 bg-[var(--card-border)] rounded w-12" />
                  <div className="h-4 bg-[var(--card-border)] rounded w-10" />
                </div>
                <div className="h-2 bg-[var(--card-border)] rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Search size={48} className="text-[var(--text-muted)] mb-4 opacity-50" />
          <h3 className="text-[var(--text-primary)] font-semibold text-base mb-1">No exercises found</h3>
          <p className="text-[var(--text-muted)] text-sm mb-4">Try adjusting your search or filters</p>
          <button
            onClick={clearFilters}
            className="border border-[#00AEEF] text-[#00AEEF] hover:bg-[rgba(0,174,239,0.1)] font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((exercise, i) => (
              <ExerciseCard key={exercise.ExerciseID} exercise={exercise} index={i} onPlay={setPlayingExercise} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Video Modal */}
      <AnimatePresence>{playingExercise && <VideoModal exercise={playingExercise} onClose={() => setPlayingExercise(null)} />}</AnimatePresence>
    </div>
  );
}
