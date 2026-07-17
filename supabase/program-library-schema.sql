-- ============================================================
-- Program Library Schema Dump
-- Generated from live database
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: goals
-- ============================================================
CREATE TABLE IF NOT EXISTS "goals" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "step_number" integer DEFAULT 1 NOT NULL,
  "step_name" text DEFAULT 'Goal'::text NOT NULL,
  "category" goal_category DEFAULT 'General Fitness & Body Composition'::goal_category NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "icon_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "category_id" integer,
  "tags" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX goals_slug_key ON public.goals USING btree (slug);
CREATE INDEX idx_goals_category ON public.goals USING btree (category);
CREATE INDEX idx_goals_active ON public.goals USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_goals_display_order ON public.goals USING btree (display_order);

ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read goals"
  ON "goals" FOR SELECT
  TO {anon,authenticated}
  USING (true);
CREATE POLICY "Trainers can manage goals"
  ON "goals" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: methods
-- ============================================================
CREATE TABLE IF NOT EXISTS "methods" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "step_number" integer DEFAULT 2 NOT NULL,
  "step_name" text DEFAULT 'Method'::text NOT NULL,
  "category" method_category DEFAULT 'Classic Strength Protocols'::method_category NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "icon_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "category_id" integer,
  "tags" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX methods_slug_key ON public.methods USING btree (slug);
CREATE INDEX idx_methods_category ON public.methods USING btree (category);
CREATE INDEX idx_methods_active ON public.methods USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_methods_display_order ON public.methods USING btree (display_order);

ALTER TABLE "methods" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read methods"
  ON "methods" FOR SELECT
  TO {anon,authenticated}
  USING (true);
CREATE POLICY "Trainers can manage methods"
  ON "methods" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: goal_method_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS "goal_method_scores" (
  "goal_id" uuid NOT NULL,
  "method_id" uuid NOT NULL,
  "overlap_count" integer DEFAULT 0 NOT NULL,
  "jaccard_index" numeric(5,4) DEFAULT 0 NOT NULL,
  "score" numeric(5,2) DEFAULT 0 NOT NULL,
  "shared_tag_ids" integer[] DEFAULT '{}'::integer[],
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("goal_id", "method_id"),
  CONSTRAINT "goal_method_scores_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE,
  CONSTRAINT "goal_method_scores_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "methods"("id") ON DELETE CASCADE
);

CREATE INDEX idx_gm_scores_goal ON public.goal_method_scores USING btree (goal_id);
CREATE INDEX idx_gm_scores_method ON public.goal_method_scores USING btree (method_id);
CREATE INDEX idx_gm_scores_score ON public.goal_method_scores USING btree (score DESC);

ALTER TABLE "goal_method_scores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read goal_method_scores"
  ON "goal_method_scores" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: program_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS "program_templates" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "step_number" integer DEFAULT 3 NOT NULL,
  "step_name" text DEFAULT 'Program'::text NOT NULL,
  "category" program_category DEFAULT 'Foundational Programs'::program_category NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "duration_weeks" integer,
  "sessions_per_week" integer,
  "icon_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "category_id" integer,
  "tags" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX program_templates_slug_key ON public.program_templates USING btree (slug);
CREATE INDEX idx_program_templates_category ON public.program_templates USING btree (category);
CREATE INDEX idx_program_templates_active ON public.program_templates USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_program_templates_display_order ON public.program_templates USING btree (display_order);

ALTER TABLE "program_templates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read program_templates"
  ON "program_templates" FOR SELECT
  TO {anon,authenticated}
  USING (true);
CREATE POLICY "Trainers can manage program_templates"
  ON "program_templates" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: exercise_library
-- ============================================================
CREATE TABLE IF NOT EXISTS "exercise_library" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "code" text,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "primary_muscle" text NOT NULL,
  "secondary_muscle" text,
  "equipment" text NOT NULL,
  "difficulty" difficulty_level NOT NULL,
  "exercise_type" text NOT NULL,
  "met_value" numeric(4,2),
  "description" text,
  "safety_notes" text,
  "youtube_url" text,
  "image_url" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "exercise_code" text,
  "type" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX exercise_library_code_key ON public.exercise_library USING btree (code);
CREATE UNIQUE INDEX exercise_library_slug_key ON public.exercise_library USING btree (slug);
CREATE INDEX idx_exercise_library_primary_muscle ON public.exercise_library USING btree (primary_muscle);
CREATE INDEX idx_exercise_library_equipment ON public.exercise_library USING btree (equipment);
CREATE INDEX idx_exercise_library_difficulty ON public.exercise_library USING btree (difficulty);
CREATE INDEX idx_exercise_library_active ON public.exercise_library USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_exercise_library_name_trgm ON public.exercise_library USING gin (name gin_trgm_ops);
CREATE UNIQUE INDEX exercise_library_exercise_code_key ON public.exercise_library USING btree (exercise_code);

ALTER TABLE "exercise_library" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read exercise_library"
  ON "exercise_library" FOR SELECT
  TO {anon,authenticated}
  USING (true);
CREATE POLICY "Trainers can manage exercise_library"
  ON "exercise_library" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: exercise_library_equipment
-- ============================================================
CREATE TABLE IF NOT EXISTS "exercise_library_equipment" (
  "exercise_library_id" uuid NOT NULL,
  "equipment_type_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("exercise_library_id", "equipment_type_id"),
  CONSTRAINT "exercise_library_equipment_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE CASCADE,
  CONSTRAINT "exercise_library_equipment_exercise_library_id_fkey" FOREIGN KEY ("exercise_library_id") REFERENCES "exercise_library"("id") ON DELETE CASCADE
);


ALTER TABLE "exercise_library_equipment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read exercise_library_equipment"
  ON "exercise_library_equipment" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: exercise_library_muscles
-- ============================================================
CREATE TABLE IF NOT EXISTS "exercise_library_muscles" (
  "exercise_library_id" uuid NOT NULL,
  "muscle_name" text NOT NULL,
  "is_primary" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("exercise_library_id", "muscle_name"),
  CONSTRAINT "exercise_library_muscles_exercise_library_id_fkey" FOREIGN KEY ("exercise_library_id") REFERENCES "exercise_library"("id") ON DELETE CASCADE
);


ALTER TABLE "exercise_library_muscles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read exercise_library_muscles"
  ON "exercise_library_muscles" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: tags
-- ============================================================
CREATE TABLE IF NOT EXISTS "tags" (
  "id" integer DEFAULT nextval('tags_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "category" text,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "slug" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX tags_name_key ON public.tags USING btree (name);
CREATE INDEX idx_tags_name ON public.tags USING btree (name);

ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tags"
  ON "tags" FOR SELECT
  TO {anon,authenticated}
  USING (true);
CREATE POLICY "Trainers can manage tags"
  ON "tags" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: goal_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS "goal_tags" (
  "goal_id" uuid NOT NULL,
  "tag_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("goal_id", "tag_id"),
  CONSTRAINT "goal_tags_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE,
  CONSTRAINT "goal_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);

CREATE INDEX idx_goal_tags_tag ON public.goal_tags USING btree (tag_id);

ALTER TABLE "goal_tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read goal_tags"
  ON "goal_tags" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: method_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS "method_tags" (
  "method_id" uuid NOT NULL,
  "tag_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("method_id", "tag_id"),
  CONSTRAINT "method_tags_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "methods"("id") ON DELETE CASCADE,
  CONSTRAINT "method_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);

CREATE INDEX idx_method_tags_tag ON public.method_tags USING btree (tag_id);

ALTER TABLE "method_tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read method_tags"
  ON "method_tags" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: program_template_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS "program_template_tags" (
  "program_template_id" uuid NOT NULL,
  "tag_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("program_template_id", "tag_id"),
  CONSTRAINT "program_template_tags_program_template_id_fkey" FOREIGN KEY ("program_template_id") REFERENCES "program_templates"("id") ON DELETE CASCADE,
  CONSTRAINT "program_template_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE
);

CREATE INDEX idx_program_template_tags_tag ON public.program_template_tags USING btree (tag_id);

ALTER TABLE "program_template_tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read program_template_tags"
  ON "program_template_tags" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: goal_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS "goal_categories" (
  "id" integer DEFAULT nextval('goal_categories_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "slug" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX goal_categories_name_key ON public.goal_categories USING btree (name);
CREATE UNIQUE INDEX goal_categories_slug_key ON public.goal_categories USING btree (slug);

ALTER TABLE "goal_categories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read goal_categories"
  ON "goal_categories" FOR SELECT
  TO {public}
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Trainers can manage goal_categories"
  ON "goal_categories" FOR ALL
  TO {public}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: method_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS "method_categories" (
  "id" integer DEFAULT nextval('method_categories_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "slug" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX method_categories_name_key ON public.method_categories USING btree (name);
CREATE UNIQUE INDEX method_categories_slug_key ON public.method_categories USING btree (slug);

ALTER TABLE "method_categories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read method_categories"
  ON "method_categories" FOR SELECT
  TO {public}
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Trainers can manage method_categories"
  ON "method_categories" FOR ALL
  TO {public}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: program_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS "program_categories" (
  "id" integer DEFAULT nextval('program_categories_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "slug" text,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX program_categories_name_key ON public.program_categories USING btree (name);
CREATE UNIQUE INDEX program_categories_slug_key ON public.program_categories USING btree (slug);

ALTER TABLE "program_categories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read program_categories"
  ON "program_categories" FOR SELECT
  TO {public}
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY "Trainers can manage program_categories"
  ON "program_categories" FOR ALL
  TO {public}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: equipment_types
-- ============================================================
CREATE TABLE IF NOT EXISTS "equipment_types" (
  "id" integer DEFAULT nextval('equipment_types_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX equipment_types_name_key ON public.equipment_types USING btree (name);

ALTER TABLE "equipment_types" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read equipment_types"
  ON "equipment_types" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: weekly_structures
-- ============================================================
CREATE TABLE IF NOT EXISTS "weekly_structures" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "category" text NOT NULL,
  "goal_id" uuid NOT NULL,
  "days_per_week" integer NOT NULL,
  "day_number" integer NOT NULL,
  "split_name" text NOT NULL,
  "sets" text,
  "reps" text,
  "programming_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "weekly_structures_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX weekly_structures_unique_goal_day ON public.weekly_structures USING btree (goal_id, days_per_week, day_number);
CREATE INDEX idx_weekly_structures_goal ON public.weekly_structures USING btree (goal_id);
CREATE INDEX idx_weekly_structures_days ON public.weekly_structures USING btree (days_per_week);

ALTER TABLE "weekly_structures" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read weekly_structures"
  ON "weekly_structures" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: app_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" integer DEFAULT nextval('app_settings_id_seq'::regclass) NOT NULL,
  "key" text NOT NULL,
  "value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX app_settings_key_key ON public.app_settings USING btree (key);

ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage app_settings"
  ON "app_settings" FOR ALL
  TO {authenticated}
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'trainer'::text)))));

-- ============================================================
-- Table: goal_program_template_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS "goal_program_template_scores" (
  "goal_id" uuid NOT NULL,
  "program_template_id" uuid NOT NULL,
  "overlap_count" integer DEFAULT 0 NOT NULL,
  "jaccard_index" numeric(5,4) DEFAULT 0 NOT NULL,
  "score" numeric(5,2) DEFAULT 0 NOT NULL,
  "shared_tag_ids" integer[] DEFAULT '{}'::integer[],
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("goal_id", "program_template_id"),
  CONSTRAINT "goal_program_template_scores_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE,
  CONSTRAINT "goal_program_template_scores_program_template_id_fkey" FOREIGN KEY ("program_template_id") REFERENCES "program_templates"("id") ON DELETE CASCADE
);

CREATE INDEX idx_gpt_scores_goal ON public.goal_program_template_scores USING btree (goal_id);
CREATE INDEX idx_gpt_scores_program ON public.goal_program_template_scores USING btree (program_template_id);
CREATE INDEX idx_gpt_scores_score ON public.goal_program_template_scores USING btree (score DESC);

ALTER TABLE "goal_program_template_scores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read goal_program_template_scores"
  ON "goal_program_template_scores" FOR SELECT
  TO {anon,authenticated}
  USING (true);

-- ============================================================
-- Table: method_program_template_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS "method_program_template_scores" (
  "method_id" uuid NOT NULL,
  "program_template_id" uuid NOT NULL,
  "overlap_count" integer DEFAULT 0 NOT NULL,
  "jaccard_index" numeric(5,4) DEFAULT 0 NOT NULL,
  "score" numeric(5,2) DEFAULT 0 NOT NULL,
  "shared_tag_ids" integer[] DEFAULT '{}'::integer[],
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("method_id", "program_template_id"),
  CONSTRAINT "method_program_template_scores_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "methods"("id") ON DELETE CASCADE,
  CONSTRAINT "method_program_template_scores_program_template_id_fkey" FOREIGN KEY ("program_template_id") REFERENCES "program_templates"("id") ON DELETE CASCADE
);

CREATE INDEX idx_mpt_scores_method ON public.method_program_template_scores USING btree (method_id);
CREATE INDEX idx_mpt_scores_program ON public.method_program_template_scores USING btree (program_template_id);
CREATE INDEX idx_mpt_scores_score ON public.method_program_template_scores USING btree (score DESC);

ALTER TABLE "method_program_template_scores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read method_program_template_scores"
  ON "method_program_template_scores" FOR SELECT
  TO {anon,authenticated}
  USING (true);
