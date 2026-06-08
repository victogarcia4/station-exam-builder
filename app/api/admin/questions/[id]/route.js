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

// PUT /api/admin/questions/[id]
// Body: { stem, options: {A,B,C,D}, correct_answer, bloom_level, rationale }
export async function PUT(request, { params }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const { id } = await params;
  const body = await request.json();
  const { stem, options, correct_answer, bloom_level, rationale } = body;

  if (!stem || !options || !correct_answer) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('questions')
    .update({ stem, options, correct_answer, bloom_level, rationale: rationale || null })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ question: data });
}

// DELETE /api/admin/questions/[id]
export async function DELETE(request, { params }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabase();
  const { id } = await params;

  // Block deletion if question has been answered by students
  const { count } = await supabase
    .from('attempt_answers')
    .select('*', { count: 'exact', head: true })
    .eq('question_id', id);

  if (count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: this question has ${count} student response(s) on record` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
