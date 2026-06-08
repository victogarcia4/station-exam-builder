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

// GET /api/admin/questions?course=BIOL2401
// Returns all stations + questions for the given course
export async function GET(request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const courseCode = searchParams.get('course') || 'BIOL2401';

  const { data: course } = await supabase.from('courses').select('id').eq('code', courseCode).single();
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const { data: exam } = await supabase.from('exams').select('id').eq('course_id', course.id).single();
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

  const { data: stations, error } = await supabase
    .from('stations')
    .select('id, number, exercise, questions(id, question_number, stem, options, correct_answer, bloom_level, rationale)')
    .eq('exam_id', exam.id)
    .order('number');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sorted = (stations || []).map(s => ({
    ...s,
    questions: (s.questions || []).sort((a, b) => a.question_number - b.question_number),
  }));

  return NextResponse.json({ stations: sorted });
}

// POST /api/admin/questions
// Body: { station_id, stem, options: {A,B,C,D}, correct_answer, bloom_level, rationale }
export async function POST(request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const body = await request.json();
  const { station_id, stem, options, correct_answer, bloom_level, rationale } = body;

  if (!station_id || !stem || !options || !correct_answer) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Auto-assign the next question_number for this station
  const { data: existing } = await supabase
    .from('questions')
    .select('question_number')
    .eq('station_id', station_id)
    .order('question_number', { ascending: false })
    .limit(1);

  const nextNum = (existing?.[0]?.question_number ?? 0) + 1;

  const { data, error } = await supabase
    .from('questions')
    .insert({ station_id, question_number: nextNum, stem, options, correct_answer, bloom_level: bloom_level || 'Remember', rationale: rationale || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ question: data });
}
