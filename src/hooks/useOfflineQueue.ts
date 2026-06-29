import { useState, useEffect, useCallback, useRef } from 'react';
import { isOnline, withRetry } from '@/lib/supabase';
import type { SupabaseClient } from '@/lib/supabase';

/**
 * ═══════════════════════════════════════════════════════════════
 * useOfflineQueue — Manages a queue of failed Supabase writes
 * Phase 2: The "Gym Wi-Fi" Fix
 * ═══════════════════════════════════════════════════════════════
 *
 * When the user is offline or a Supabase write fails, items are
 * enqueued to localStorage. On reconnect, the queue auto-drains.
 */

export interface QueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update';
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: string;
  error?: string;
}

export interface OfflineQueueState {
  queue: QueueItem[];
  isProcessing: boolean;
  pendingCount: number;
  failedCount: number;
  enqueue: (item: Omit<QueueItem, 'id' | 'attempts' | 'createdAt'>) => void;
  dequeue: (id: string) => void;
  retryAll: () => Promise<void>;
  clearQueue: () => void;
}

/* ─── Storage helpers ─── */

const QUEUE_KEY_PREFIX = 'azfit:offline_queue:';

function getQueueKey(userId: string): string {
  return `${QUEUE_KEY_PREFIX}${userId}`;
}

function getQueue(userId: string): QueueItem[] {
  try {
    const raw = localStorage.getItem(getQueueKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

function setQueue(userId: string, queue: QueueItem[]): void {
  try {
    localStorage.setItem(getQueueKey(userId), JSON.stringify(queue));
  } catch (e) {
    console.error('[useOfflineQueue] Failed to save queue:', e);
  }
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/* ─── Hook ─── */

export function useOfflineQueue(userId: string, supabase: SupabaseClient): OfflineQueueState {
  const [queue, setQueueState] = useState<QueueItem[]>(() => getQueue(userId));
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  const pendingCount = queue.filter((q) => q.attempts < 3).length;
  const failedCount = queue.filter((q) => q.attempts >= 3).length;

  /* ── Persist queue to localStorage whenever it changes ── */
  useEffect(() => {
    setQueue(userId, queue);
  }, [queue, userId]);

  /* ── retryAll: process entire queue ── */
  const retryAll = useCallback(async () => {
    if (processingRef.current || !isOnline()) return;
    processingRef.current = true;
    setIsProcessing(true);

    const currentQueue = getQueue(userId);
    const remaining: QueueItem[] = [];

    for (const item of currentQueue) {
      try {
        await withRetry(
          async () => {
            const tableRef = (supabase as unknown as { from: (t: string) => { insert: (p: unknown) => Promise<{ error: { message: string } | null }>; update: (p: unknown) => Promise<{ error: { message: string } | null }> } }).from(item.table);
            const { error } =
              item.operation === 'insert'
                ? await tableRef.insert(item.payload)
                : await tableRef.update(item.payload);
            if (error) throw new Error(error.message);
          },
          2,
          500
        );
        // Success: item dropped from queue
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const updatedItem = {
          ...item,
          attempts: item.attempts + 1,
          error: error.message,
        };
        remaining.push(updatedItem);
      }
    }

    setQueueState(remaining);
    processingRef.current = false;
    setIsProcessing(false);
  }, [userId, supabase]);

  /* ── Auto-drain queue when coming back online ── */
  useEffect(() => {
    const handleOnline = () => {
      if (queue.length > 0 && !processingRef.current) {
        retryAll();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queue, retryAll]);

  /* ── enqueue: add item to queue ── */
  const enqueue = useCallback(
    (item: Omit<QueueItem, 'id' | 'attempts' | 'createdAt'>) => {
      const newItem: QueueItem = {
        ...item,
        id: generateId(),
        attempts: 0,
        createdAt: new Date().toISOString(),
      };
      setQueueState((prev) => [...prev, newItem]);
    },
    []
  );

  /* ── dequeue: remove item by id ── */
  const dequeue = useCallback((id: string) => {
    setQueueState((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /* ── clearQueue: wipe everything ── */
  const clearQueue = useCallback(() => {
    setQueueState([]);
  }, []);

  return {
    queue,
    isProcessing,
    pendingCount,
    failedCount,
    enqueue,
    dequeue,
    retryAll,
    clearQueue,
  };
}
