export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: 'trainer' | 'client';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'trainer' | 'client';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: 'trainer' | 'client';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          trainer_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          date_of_birth: string | null;
          gender: 'male' | 'female' | 'other' | null;
          height_cm: number | null;
          weight_kg: number | null;
          body_fat_percentage: number | null;
          fitness_goal: string | null;
          experience_level: 'beginner' | 'intermediate' | 'advanced' | null;
          status: 'active' | 'inactive' | 'on_hold';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          date_of_birth?: string | null;
          gender?: 'male' | 'female' | 'other' | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          body_fat_percentage?: number | null;
          fitness_goal?: string | null;
          experience_level?: 'beginner' | 'intermediate' | 'advanced' | null;
          status?: 'active' | 'inactive' | 'on_hold';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          date_of_birth?: string | null;
          gender?: 'male' | 'female' | 'other' | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          body_fat_percentage?: number | null;
          fitness_goal?: string | null;
          experience_level?: 'beginner' | 'intermediate' | 'advanced' | null;
          status?: 'active' | 'inactive' | 'on_hold';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          trainer_id: string;
          client_id: string | null;
          name: string;
          description: string | null;
          duration_weeks: number;
          frequency_per_week: number;
          status: 'draft' | 'active' | 'completed' | 'archived';
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          client_id?: string | null;
          name: string;
          description?: string | null;
          duration_weeks?: number;
          frequency_per_week?: number;
          status?: 'draft' | 'active' | 'completed' | 'archived';
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          client_id?: string | null;
          name?: string;
          description?: string | null;
          duration_weeks?: number;
          frequency_per_week?: number;
          status?: 'draft' | 'active' | 'completed' | 'archived';
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workouts: {
        Row: {
          id: string;
          program_id: string;
          name: string;
          day_of_week: number | null;
          week_number: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          name: string;
          day_of_week?: number | null;
          week_number?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          name?: string;
          day_of_week?: number | null;
          week_number?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          workout_id: string;
          name: string;
          sets: number;
          reps: string;
          weight_kg: number | null;
          rest_seconds: number | null;
          rpe: number | null;
          order_index: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          name: string;
          sets?: number;
          reps?: string;
          weight_kg?: number | null;
          rest_seconds?: number | null;
          rpe?: number | null;
          order_index?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout_id?: string;
          name?: string;
          sets?: number;
          reps?: string;
          weight_kg?: number | null;
          rest_seconds?: number | null;
          rpe?: number | null;
          order_index?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workout_logs: {
        Row: {
          id: string;
          client_id: string;
          workout_id: string;
          completed_at: string;
          duration_minutes: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          workout_id: string;
          completed_at?: string;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          workout_id?: string;
          completed_at?: string;
          duration_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      body_composition: {
        Row: {
          id: string;
          client_id: string;
          recorded_at: string;
          weight_kg: number | null;
          body_fat_percentage: number | null;
          muscle_mass_kg: number | null;
          bmi: number | null;
          chest_cm: number | null;
          waist_cm: number | null;
          hips_cm: number | null;
          arms_cm: number | null;
          thighs_cm: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          recorded_at?: string;
          weight_kg?: number | null;
          body_fat_percentage?: number | null;
          muscle_mass_kg?: number | null;
          bmi?: number | null;
          chest_cm?: number | null;
          waist_cm?: number | null;
          hips_cm?: number | null;
          arms_cm?: number | null;
          thighs_cm?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          recorded_at?: string;
          weight_kg?: number | null;
          body_fat_percentage?: number | null;
          muscle_mass_kg?: number | null;
          bmi?: number | null;
          chest_cm?: number | null;
          waist_cm?: number | null;
          hips_cm?: number | null;
          arms_cm?: number | null;
          thighs_cm?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          content: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          content: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          content?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
