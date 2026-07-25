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
      // ─── Existing Tables (Phase 1) ───
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: "admin" | "trainer" | "client";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: "trainer" | "client";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: "trainer" | "client";
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
          gender: "male" | "female" | "other" | null;
          height_cm: number | null;
          weight_kg: number | null;
          body_fat_percentage: number | null;
          fitness_goal: string | null;
          experience_level: "beginner" | "intermediate" | "advanced" | null;
          status: "active" | "inactive" | "on_hold" | "archived";
          notes: string | null;
          intake_profile: Json | null;
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
          gender?: "male" | "female" | "other" | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          body_fat_percentage?: number | null;
          fitness_goal?: string | null;
          experience_level?: "beginner" | "intermediate" | "advanced" | null;
          status?: "active" | "inactive" | "on_hold" | "archived";
          notes?: string | null;
          intake_profile?: Json | null;
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
          gender?: "male" | "female" | "other" | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          body_fat_percentage?: number | null;
          fitness_goal?: string | null;
          experience_level?: "beginner" | "intermediate" | "advanced" | null;
          status?: "active" | "inactive" | "on_hold" | "archived";
          notes?: string | null;
          intake_profile?: Json | null;
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
          status: "draft" | "active" | "completed" | "archived";
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
          status?: "draft" | "active" | "completed" | "archived";
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
          status?: "draft" | "active" | "completed" | "archived";
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
      workout_log_entries: {
        Row: {
          id: string;
          workout_log_id: string;
          client_id: string;
          exercise_id: string;
          exercise_name: string;
          sets_completed: number;
          total_sets: number;
          reps_per_set: number[];
          weight_per_set: number[];
          rpe_per_set: number[];
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_log_id: string;
          client_id: string;
          exercise_id: string;
          exercise_name: string;
          sets_completed?: number;
          total_sets?: number;
          reps_per_set?: number[];
          weight_per_set?: number[];
          rpe_per_set?: number[];
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout_log_id?: string;
          client_id?: string;
          exercise_id?: string;
          exercise_name?: string;
          sets_completed?: number;
          total_sets?: number;
          reps_per_set?: number[];
          weight_per_set?: number[];
          rpe_per_set?: number[];
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          read?: boolean;
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
      skinfold_assessments: {
        Row: {
          id: string;
          client_id: string;
          assessed_by: string | null;
          recorded_at: string;
          protocol: "jp3" | "jp7" | "poliquin12";
          sites: Json;
          sum_mm: number | null;
          body_fat_pct: number | null;
          weight_kg: number | null;
          age_years: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          assessed_by?: string | null;
          recorded_at?: string;
          protocol: "jp3" | "jp7" | "poliquin12";
          sites?: Json;
          sum_mm?: number | null;
          body_fat_pct?: number | null;
          weight_kg?: number | null;
          age_years?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          assessed_by?: string | null;
          recorded_at?: string;
          protocol?: "jp3" | "jp7" | "poliquin12";
          sites?: Json;
          sum_mm?: number | null;
          body_fat_pct?: number | null;
          weight_kg?: number | null;
          age_years?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "skinfold_assessments_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
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
      sessions: {
        Row: {
          id: string;
          trainer_id: string;
          client_id: string;
          title: string;
          type: string;
          status: string;
          starts_at: string;
          ends_at: string;
          location: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          client_id: string;
          title: string;
          type?: string;
          status?: string;
          starts_at: string;
          ends_at: string;
          location?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          client_id?: string;
          title?: string;
          type?: string;
          status?: string;
          starts_at?: string;
          ends_at?: string;
          location?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      // ─── Blueprint Tables (Phase 2) ───
      goal_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          category_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          category_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          category_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "goal_categories";
            referencedColumns: ["id"];
          }
        ];
      };
      method_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      methods: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          category_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          category_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          category_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "methods_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "method_categories";
            referencedColumns: ["id"];
          }
        ];
      };
      program_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      program_templates: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          category_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          category_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          category_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_templates_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "program_categories";
            referencedColumns: ["id"];
          }
        ];
      };
      tags: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      goal_tags: {
        Row: {
          goal_id: string;
          tag_id: string;
        };
        Insert: {
          goal_id: string;
          tag_id: string;
        };
        Update: {
          goal_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_tags_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goal_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          }
        ];
      };
      method_tags: {
        Row: {
          method_id: string;
          tag_id: string;
        };
        Insert: {
          method_id: string;
          tag_id: string;
        };
        Update: {
          method_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_tags_method_id_fkey";
            columns: ["method_id"];
            isOneToOne: false;
            referencedRelation: "methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          }
        ];
      };
      program_template_tags: {
        Row: {
          program_template_id: string;
          tag_id: string;
        };
        Insert: {
          program_template_id: string;
          tag_id: string;
        };
        Update: {
          program_template_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_template_tags_program_template_id_fkey";
            columns: ["program_template_id"];
            isOneToOne: false;
            referencedRelation: "program_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_template_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          }
        ];
      };
      exercise_library: {
        Row: {
          id: string;
          exercise_id: string;
          name: string;
          primary_muscle: string | null;
          secondary_muscle: string | null;
          equipment: string | null;
          difficulty: string | null;
          exercise_type: string | null;
          met_value: string | null;
          description: string | null;
          safety_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          exercise_id: string;
          name: string;
          primary_muscle?: string | null;
          secondary_muscle?: string | null;
          equipment?: string | null;
          difficulty?: string | null;
          exercise_type?: string | null;
          met_value?: string | null;
          description?: string | null;
          safety_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          exercise_id?: string;
          name?: string;
          primary_muscle?: string | null;
          secondary_muscle?: string | null;
          equipment?: string | null;
          difficulty?: string | null;
          exercise_type?: string | null;
          met_value?: string | null;
          description?: string | null;
          safety_notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      weekly_structures: {
        Row: {
          id: string;
          goal_category: string;
          goal_name: string;
          days_per_week: string;
          day_label: string;
          split_name: string;
          sets_range: string | null;
          reps_range: string | null;
          programming_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_category: string;
          goal_name: string;
          days_per_week: string;
          day_label: string;
          split_name: string;
          sets_range?: string | null;
          reps_range?: string | null;
          programming_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          goal_category?: string;
          goal_name?: string;
          days_per_week?: string;
          day_label?: string;
          split_name?: string;
          sets_range?: string | null;
          reps_range?: string | null;
          programming_notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      goal_method_scores: {
        Row: {
          goal_id: string;
          method_id: string;
          score: number;
          updated_at: string;
        };
        Insert: {
          goal_id: string;
          method_id: string;
          score?: number;
          updated_at?: string;
        };
        Update: {
          goal_id?: string;
          method_id?: string;
          score?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_method_scores_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goal_method_scores_method_id_fkey";
            columns: ["method_id"];
            isOneToOne: false;
            referencedRelation: "methods";
            referencedColumns: ["id"];
          }
        ];
      };
      method_program_scores: {
        Row: {
          method_id: string;
          program_template_id: string;
          score: number;
          updated_at: string;
        };
        Insert: {
          method_id: string;
          program_template_id: string;
          score?: number;
          updated_at?: string;
        };
        Update: {
          method_id?: string;
          program_template_id?: string;
          score?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_program_scores_method_id_fkey";
            columns: ["method_id"];
            isOneToOne: false;
            referencedRelation: "methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_program_scores_program_template_id_fkey";
            columns: ["program_template_id"];
            isOneToOne: false;
            referencedRelation: "program_templates";
            referencedColumns: ["id"];
          }
        ];
      };
      pipeline_scores: {
        Row: {
          goal_id: string;
          method_id: string;
          program_template_id: string;
          score: number;
          updated_at: string;
        };
        Insert: {
          goal_id: string;
          method_id: string;
          program_template_id: string;
          score?: number;
          updated_at?: string;
        };
        Update: {
          goal_id?: string;
          method_id?: string;
          program_template_id?: string;
          score?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_scores_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_scores_method_id_fkey";
            columns: ["method_id"];
            isOneToOne: false;
            referencedRelation: "methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_scores_program_template_id_fkey";
            columns: ["program_template_id"];
            isOneToOne: false;
            referencedRelation: "program_templates";
            referencedColumns: ["id"];
          }
        ];
      };
      settings_config: {
        Row: {
          id: string;
          key: string;
          value: string;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: string;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      check_in_forms: {
        Row: {
          id: string;
          trainer_id: string;
          title: string;
          description: string | null;
          fields: Json;
          frequency: string;
          active: boolean;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          title: string;
          description?: string | null;
          fields?: Json;
          frequency?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          title?: string;
          description?: string | null;
          fields?: Json;
          frequency?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "check_in_forms_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      check_in_submissions: {
        Row: {
          id: string;
          form_id: string;
          client_id: string;
          answers: Json;
          submitted_at: string;
          reviewed_at: string | null;
          trainer_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          client_id: string;
          answers?: Json;
          submitted_at?: string;
          reviewed_at?: string | null;
          trainer_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          form_id?: string;
          client_id?: string;
          answers?: Json;
          submitted_at?: string;
          reviewed_at?: string | null;
          trainer_notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "check_in_submissions_form_id_fkey";
            columns: ["form_id"];
            isOneToOne: false;
            referencedRelation: "check_in_forms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "check_in_submissions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
      };
      habits: {
        Row: {
          id: string;
          trainer_id: string;
          client_id: string;
          name: string;
          target_frequency: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          client_id: string;
          name: string;
          target_frequency?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          client_id?: string;
          name?: string;
          target_frequency?: string;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habits_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "habits_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
      };
      habit_logs: {
        Row: {
          id: string;
          habit_id: string;
          client_id: string;
          log_date: string;
          done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          habit_id: string;
          client_id: string;
          log_date: string;
          done?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          habit_id?: string;
          client_id?: string;
          log_date?: string;
          done?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "habit_logs_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          }
        ];
      };
      faq_entries: {
        Row: {
          id: string;
          question: string;
          answer: string;
          keywords: string[];
          roles: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          answer: string;
          keywords?: string[];
          roles?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          question?: string;
          answer?: string;
          keywords?: string[];
          roles?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          intent: string | null;
          tokens_input: number | null;
          tokens_output: number | null;
          model_used: string | null;
          latency_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: "user" | "assistant";
          content: string;
          intent?: string | null;
          tokens_input?: number | null;
          tokens_output?: number | null;
          model_used?: string | null;
          latency_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: "user" | "assistant";
          content?: string;
          intent?: string | null;
          tokens_input?: number | null;
          tokens_output?: number | null;
          model_used?: string | null;
          latency_ms?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      chat_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      chat_feedback: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          rating: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          user_id: string;
          rating: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          user_id?: string;
          rating?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_feedback_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "chat_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      foods_cache: {
        Row: {
          id: string;
          source: "off" | "custom";
          source_id: string | null;
          name: string;
          brand: string | null;
          category: string | null;
          serving_size_g: number | null;
          calories: number;
          protein: number;
          carbs: number;
          fats: number;
          raw: Json | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source?: "off" | "custom";
          source_id?: string | null;
          name: string;
          brand?: string | null;
          category?: string | null;
          serving_size_g?: number | null;
          calories?: number;
          protein?: number;
          carbs?: number;
          fats?: number;
          raw?: Json | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source?: "off" | "custom";
          source_id?: string | null;
          name?: string;
          brand?: string | null;
          category?: string | null;
          serving_size_g?: number | null;
          calories?: number;
          protein?: number;
          carbs?: number;
          fats?: number;
          raw?: Json | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "foods_cache_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      nutrition_logs: {
        Row: {
          id: string;
          user_id: string;
          logged_date: string;
          meal_type: "breakfast" | "lunch" | "dinner" | "snacks";
          food_id: string;
          quantity_g: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          logged_date?: string;
          meal_type: "breakfast" | "lunch" | "dinner" | "snacks";
          food_id: string;
          quantity_g?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          logged_date?: string;
          meal_type?: "breakfast" | "lunch" | "dinner" | "snacks";
          food_id?: string;
          quantity_g?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nutrition_logs_food_id_fkey";
            columns: ["food_id"];
            isOneToOne: false;
            referencedRelation: "foods_cache";
            referencedColumns: ["id"];
          }
        ];
      };
      nutrition_targets: {
        Row: {
          user_id: string;
          calories: number | null;
          protein_g: number | null;
          carbs_g: number | null;
          fats_g: number | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          calories?: number | null;
          protein_g?: number | null;
          carbs_g?: number | null;
          fats_g?: number | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          calories?: number | null;
          protein_g?: number | null;
          carbs_g?: number | null;
          fats_g?: number | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_targets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      photo_metadata: {
        Row: {
          id: string;
          storage_path: string;
          owner_id: string;
          category: "Front" | "Back" | "Side" | "Other" | null;
          taken_on: string | null;
          weight_kg: number | null;
          body_fat_pct: number | null;
          notes: string | null;
          trainer_notes: string | null;
          is_milestone: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          storage_path: string;
          owner_id: string;
          category?: "Front" | "Back" | "Side" | "Other" | null;
          taken_on?: string | null;
          weight_kg?: number | null;
          body_fat_pct?: number | null;
          notes?: string | null;
          trainer_notes?: string | null;
          is_milestone?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          storage_path?: string;
          owner_id?: string;
          category?: "Front" | "Back" | "Side" | "Other" | null;
          taken_on?: string | null;
          weight_kg?: number | null;
          body_fat_pct?: number | null;
          notes?: string | null;
          trainer_notes?: string | null;
          is_milestone?: boolean | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "photo_metadata_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      photo_metadata_owner: {
        Row: {
          id: string;
          storage_path: string;
          owner_id: string;
          category: "Front" | "Back" | "Side" | "Other" | null;
          taken_on: string | null;
          weight_kg: number | null;
          body_fat_pct: number | null;
          notes: string | null;
          is_milestone: boolean | null;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      compute_jaccard: {
        Args: { tags_a: string[]; tags_b: string[] };
        Returns: number;
      };
      get_goal_methods: {
        Args: { p_goal_id: string; p_limit?: number };
        Returns: { method_id: string; method_name: string; score: number }[];
      };
      get_method_program_templates: {
        Args: { p_method_id: string; p_limit?: number };
        Returns: { program_template_id: string; program_name: string; score: number }[];
      };
      get_top_pipelines: {
        Args: { p_goal_id: string; p_limit?: number };
        Returns: { goal_id: string; method_id: string; program_template_id: string; score: number }[];
      };
      refresh_all_scores: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
