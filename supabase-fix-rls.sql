-- ============================================
-- RLS POLICY FIX
-- ============================================
-- This app uses the anon key with NO Supabase auth
-- (students just type name/email in a form).
-- The original JWT-based policies can never match,
-- so we replace them with anon-accessible policies.
-- ============================================

-- 1. Drop the old broken (JWT-based) policies
DROP POLICY IF EXISTS "Students can insert attempts" ON attempts;
DROP POLICY IF EXISTS "Students can view own attempts" ON attempts;
DROP POLICY IF EXISTS "Students can insert answers" ON attempt_answers;
DROP POLICY IF EXISTS "Students can view own answers" ON attempt_answers;

-- 2. ATTEMPTS - allow anon to insert, select (for returning id), and update (for completion)
CREATE POLICY "anon_insert_attempts"
  ON attempts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "anon_select_attempts"
  ON attempts FOR SELECT
  USING (true);

CREATE POLICY "anon_update_attempts"
  ON attempts FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 3. ATTEMPT_ANSWERS - allow anon to insert and select
CREATE POLICY "anon_insert_answers"
  ON attempt_answers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "anon_select_answers"
  ON attempt_answers FOR SELECT
  USING (true);

-- ============================================
-- DONE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies fixed for anon access';
  RAISE NOTICE '   attempts: INSERT, SELECT, UPDATE';
  RAISE NOTICE '   attempt_answers: INSERT, SELECT';
END $$;
