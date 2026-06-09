import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'station-images';
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

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

// POST /api/admin/upload-image
// Body: FormData — fields: file (File), stationId (string)
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = formData.get('file');
  const stationId = formData.get('stationId');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (!stationId) {
    return NextResponse.json({ error: 'stationId is required' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Only PNG, JPEG, and WebP images are allowed' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File size must be under 5 MB' }, { status: 400 });
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png';
  const filename = `station-${stationId}-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // ── Upload to Supabase Storage ────────────────────────────────────
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}. Make sure the 'station-images' bucket exists in your Supabase project.` },
      { status: 500 }
    );
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);

  // ── Update station record ─────────────────────────────────────────
  const { error: updateError } = await supabase
    .from('stations')
    .update({ image_url: publicUrl })
    .eq('id', stationId);

  if (updateError) {
    return NextResponse.json({ error: `DB update failed: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ imageUrl: publicUrl });
}
