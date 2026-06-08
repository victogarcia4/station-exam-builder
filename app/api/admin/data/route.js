import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value === 'authenticated';
}

export async function GET(request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'overview';
  const courseFilter = searchParams.get('course') || 'all';

  // Build exam_id -> course_code map (used by all endpoints)
  const { data: allExams } = await supabase
    .from('exams')
    .select('id, courses!course_id(code)');

  const examCourseMap = {};
  allExams?.forEach(e => { examCourseMap[e.id] = e.courses?.code || '—'; });

  // Get exam IDs for a specific course (for server-side filtering)
  const filteredExamIds = courseFilter === 'all'
    ? null
    : Object.entries(examCourseMap).filter(([, code]) => code === courseFilter).map(([id]) => id);

  // ── OVERVIEW ─────────────────────────────────────────────────────────────
  if (type === 'overview') {
    let query = supabase
      .from('attempts')
      .select('id, mode, score, total, percent, exam_id')
      .not('completed_at', 'is', null);

    if (filteredExamIds) {
      if (filteredExamIds.length === 0) {
        return NextResponse.json({ total: 0, studyCount: 0, examCount: 0, avgScore: 0, passRate: 0 });
      }
      query = query.in('exam_id', filteredExamIds);
    }

    const { data: attempts } = await query;

    const total = attempts?.length || 0;
    const studyCount = attempts?.filter(a => a.mode === 'study').length || 0;
    const examCount = attempts?.filter(a => a.mode === 'exam').length || 0;
    const scores = attempts?.map(a => a.percent).filter(Boolean) || [];
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : 0;
    const passing = scores.filter(s => s >= 70).length;
    const passRate = scores.length ? Math.round((passing / scores.length) * 100) : 0;

    return NextResponse.json({ total, studyCount, examCount, avgScore, passRate });
  }

  // ── ATTEMPTS ──────────────────────────────────────────────────────────────
  if (type === 'attempts') {
    let query = supabase
      .from('attempts')
      .select('id, student_name, student_email, course_section, mode, score, total, percent, duration_seconds, started_at, completed_at, exam_id')
      .order('started_at', { ascending: false })
      .limit(200);

    if (filteredExamIds) {
      if (filteredExamIds.length === 0) return NextResponse.json({ attempts: [] });
      query = query.in('exam_id', filteredExamIds);
    }

    const { data: attempts } = await query;

    const enriched = (attempts || []).map(a => ({
      ...a,
      course_code: examCourseMap[a.exam_id] || '—',
    }));

    return NextResponse.json({ attempts: enriched });
  }

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  if (type === 'analytics') {
    const { data: answers } = await supabase
      .from('attempt_answers')
      .select(`
        is_correct,
        selected_answer,
        attempt:attempts!attempt_id(exam_id),
        question:questions!question_id(question_number, stem, correct_answer, bloom_level, station:stations!station_id(number, exercise))
      `)
      .limit(5000);

    if (!answers?.length) return NextResponse.json({ questions: [] });

    const qMap = new Map();
    for (const ans of answers) {
      if (!ans.question) continue;

      const answerCourse = examCourseMap[ans.attempt?.exam_id] || '—';
      if (filteredExamIds && !filteredExamIds.includes(ans.attempt?.exam_id)) continue;

      // Key by course+question_number to avoid BIOL2401/2402 collisions
      const key = `${answerCourse}-Q${ans.question.question_number}`;
      if (!qMap.has(key)) {
        qMap.set(key, {
          question_number: ans.question.question_number,
          stem: ans.question.stem,
          correct_answer: ans.question.correct_answer,
          bloom_level: ans.question.bloom_level,
          station_number: ans.question.station?.number,
          station_exercise: ans.question.station?.exercise,
          course_code: answerCourse,
          total: 0,
          correct: 0,
          answer_counts: { A: 0, B: 0, C: 0, D: 0 },
        });
      }
      const q = qMap.get(key);
      q.total++;
      if (ans.is_correct) q.correct++;
      if (ans.selected_answer) q.answer_counts[ans.selected_answer]++;
    }

    const questions = Array.from(qMap.values())
      .map(q => ({ ...q, error_rate: q.total > 0 ? Math.round(((q.total - q.correct) / q.total) * 100) : 0 }))
      .filter(q => q.total >= 3)
      .sort((a, b) => b.error_rate - a.error_rate)
      .slice(0, 20);

    return NextResponse.json({ questions });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
