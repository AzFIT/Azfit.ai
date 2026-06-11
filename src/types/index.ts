// Barrel export for all types
export type { Database } from './supabase';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  type: 'session' | 'assessment' | 'blocked' | 'check-in' | 'reminder';
  clientId?: string;
  clientName?: string;
  description?: string;
  recurring?: boolean;
  color?: string;
}
