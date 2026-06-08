-- ============================================
-- Station Exam Builder - Database Schema
-- Phase 2: Core tables for BIOL 2401/2402
-- ============================================

-- 1. COURSES TABLE
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  station_count INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EXAMS TABLE
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  version TEXT DEFAULT 'v1.0',
  status TEXT DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- 3. STATIONS TABLE
CREATE TABLE IF NOT EXISTS stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  exercise TEXT NOT NULL,
  image_url TEXT,
  image_description TEXT,
  learning_objectives JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  stem TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer CHAR(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  rationale TEXT,
  bloom_level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ATTEMPTS TABLE (Student exam sessions)
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  course_section TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('study', 'exam')),
  score INTEGER,
  total INTEGER,
  percent NUMERIC(5,2),
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 6. ATTEMPT_ANSWERS TABLE (Individual question responses)
CREATE TABLE IF NOT EXISTS attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer CHAR(1) CHECK (selected_answer IN ('A', 'B', 'C', 'D', NULL)),
  is_correct BOOLEAN
);

-- ============================================
-- INDEXES for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_questions_station ON questions(station_id);
CREATE INDEX IF NOT EXISTS idx_questions_number ON questions(question_number);
CREATE INDEX IF NOT EXISTS idx_stations_exam ON stations(exam_id);
CREATE INDEX IF NOT EXISTS idx_stations_number ON stations(number);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_email ON attempts(student_email);
CREATE INDEX IF NOT EXISTS idx_attempts_completed ON attempts(completed_at);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question ON attempt_answers(question_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on sensitive tables
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempt_answers ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert their own attempts
CREATE POLICY "Students can insert attempts"
  ON attempts FOR INSERT
  WITH CHECK (true);

-- Policy: Students can view their own attempts
CREATE POLICY "Students can view own attempts"
  ON attempts FOR SELECT
  USING (student_email = current_setting('request.jwt.claims', true)::json->>'email'
         OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Policy: Anyone can insert attempt answers
CREATE POLICY "Students can insert answers"
  ON attempt_answers FOR INSERT
  WITH CHECK (true);

-- Policy: Students can view their own answers (through attempt relationship)
CREATE POLICY "Students can view own answers"
  ON attempt_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM attempts
      WHERE attempts.id = attempt_answers.attempt_id
      AND attempts.student_email = current_setting('request.jwt.claims', true)::json->>'email'
    )
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- ============================================
-- COMMENTS for Documentation
-- ============================================

COMMENT ON TABLE courses IS 'Available courses (BIOL2401, BIOL2402)';
COMMENT ON TABLE exams IS 'Exam versions per course';
COMMENT ON TABLE stations IS 'Exam stations with images and learning objectives';
COMMENT ON TABLE questions IS 'Multiple choice questions per station';
COMMENT ON TABLE attempts IS 'Student exam/study sessions';
COMMENT ON TABLE attempt_answers IS 'Individual question responses per attempt';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '📊 Tables created: courses, exams, stations, questions, attempts, attempt_answers';
  RAISE NOTICE '🔒 Row Level Security enabled on attempts and attempt_answers';
  RAISE NOTICE '⚡ Performance indexes added';
  RAISE NOTICE '';
  RAISE NOTICE '➡️  Next step: Run the seed script to populate with BIOL 2401 data';
END $$;
