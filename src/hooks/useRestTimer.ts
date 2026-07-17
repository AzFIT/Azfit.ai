import { useState, useRef, useCallback, useEffect } from "react";

interface TimerState {
  active: boolean;
  remaining: number;
  total: number;
  setIndex: number;
}

export function useRestTimer() {
  const [timers, setTimers] = useState<Record<string, TimerState>>({});
  const intervals = useRef<Record<string, number>>({});

  const startTimer = useCallback((exerciseId: string, setIndex: number, seconds: number) => {
    if (intervals.current[exerciseId]) {
      clearInterval(intervals.current[exerciseId]);
    }

    setTimers((prev) => ({
      ...prev,
      [exerciseId]: { active: true, remaining: seconds, total: seconds, setIndex },
    }));

    intervals.current[exerciseId] = window.setInterval(() => {
      setTimers((prev) => {
        const current = prev[exerciseId];
        if (!current || current.remaining <= 1) {
          if (intervals.current[exerciseId]) {
            clearInterval(intervals.current[exerciseId]);
            delete intervals.current[exerciseId];
          }
          return {
            ...prev,
            [exerciseId]: {
              active: false,
              remaining: 0,
              total: current?.total || seconds,
              setIndex: current?.setIndex ?? setIndex,
            },
          };
        }
        return {
          ...prev,
          [exerciseId]: { ...current, remaining: current.remaining - 1 },
        };
      });
    }, 1000);
  }, []);

  const skipTimer = useCallback((exerciseId: string) => {
    if (intervals.current[exerciseId]) {
      clearInterval(intervals.current[exerciseId]);
      delete intervals.current[exerciseId];
    }
    setTimers((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId]
        ? { ...prev[exerciseId], active: false, remaining: 0 }
        : { active: false, remaining: 0, total: 0, setIndex: 0 },
    }));
  }, []);

  const addTime = useCallback((exerciseId: string, seconds: number) => {
    setTimers((prev) => {
      const current = prev[exerciseId];
      if (!current) return prev;
      return {
        ...prev,
        [exerciseId]: { ...current, remaining: current.remaining + seconds },
      };
    });
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    return () => {
      // We intentionally read the latest ref here so all active intervals are cleared on unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(intervals.current).forEach(clearInterval);
    };
  }, []);

  return { timers, startTimer, skipTimer, addTime, formatTime };
}
