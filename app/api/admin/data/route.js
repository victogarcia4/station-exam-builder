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

  if (type === 'overview') {
    const { data: attempts } = await supabase
      .from('attempts')
      .select('id, mode, score, total, percent, started_at, completed_at')
      .not('completed_at', 'is', null);

    const total = attempts?.length || 0;
    const studyCount = attempts?.filter(a => a.mode === 'study').length || 0;
    const examCount = attempts?.filter(a => a.mode === 'exam').length || 0;
    const scores = attempts?.map(a => a.percent).filter(Boolean) || [];
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : 0;
    const passing = scores.filter(s => s >= 70).length;
    const passRate = scores.length ? Math.round((passing / scores.length) * 100) : 0;

    return NextResponse.json({ total, studyCount, examCount, avgScore, passRate });
  }

  if (type === 'attempts') {
    const { data: attempts } = await supabase
      .from('attempts')
      .select('id, student_name, student_email, course_section, mode, score, total, percent, duration_seconds, started_at, completed_at')
      .order('started_at', { ascending: false })
      .limit(200);

    return NextResponse.json({ attempts: attempts || [] });
  }

  if (type === 'analytics') {
    // Get all attempt_answers joined with questions
    const { data: answers } = await supabase
      .from('attempt_answers')
      .select(`
        is_correct,
        selected_answer,
        question:questions(question_number, stem, correct_answer, bloom_level, station:stations(number, exercise))
      `)
      .limit(5000);

    if (!answers?.length) return NextResponse.json({ questions: [] });

    // Group by question
    const qMap = new Map();
    for (const ans of answers) {
      if (!ans.question) continue;
      const qNum = ans.question.question_number;
      if (!qMap.has(qNum)) {
        qMap.set(qNum, {
          question_number: qNum,
          stem: ans.question.stem,
          correct_answer: ans.question.correct_answer,
          bloom_level: ans.question.bloom_level,
          station_number: ans.question.station?.number,
          station_exercise: ans.question.station?.exercise,
          total: 0,
          correct: 0,
          answer_counts: { A: 0, B: 0, C: 0, D: 0 },
        });
      }
      const q = qMap.get(qNum);
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
