-- ============================================================
-- CATEGORY TABLES — RLS FIX
-- Enable RLS on goal_categories, method_categories, program_categories
-- and add policies for authenticated read + trainer manage.
-- ============================================================

ALTER TABLE goal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE method_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_categories ENABLE ROW LEVEL SECURITY;

-- SELECT for all authenticated users
CREATE POLICY "Authenticated users can read goal_categories"
  ON goal_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read method_categories"
  ON method_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read program_categories"
  ON program_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE for trainers only
CREATE POLICY "Trainers can manage goal_categories"
  ON goal_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'
    )
  );

CREATE POLICY "Trainers can manage method_categories"
  ON method_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'
    )
  );

CREATE POLICY "Trainers can manage program_categories"
  ON program_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer'
    )
  );
