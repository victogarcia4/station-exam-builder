import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const OPENROUTER_IMAGE_URL = 'https://openrouter.ai/api/v1/images/generations';
const IMAGE_MODEL = 'black-forest-labs/flux-schnell';
const BUCKET = 'station-images';

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

// POST /api/admin/generate-image
// Body: { stationId: string, prompt: string }
// Generates an image via OpenRouter → uploads to Supabase Storage → updates station.image_url
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured in environment variables' }, { status: 500 });
  }

  const supabase = getSupabase();
  const body = await request.json();
  const { stationId, prompt } = body;

  if (!stationId || !prompt?.trim()) {
    return NextResponse.json({ error: 'stationId and prompt are required' }, { status: 400 });
  }

  // Verify station exists
  const { data: station } = await supabase
    .from('stations')
    .select('id, number, exercise')
    .eq('id', stationId)
    .single();

  if (!station) {
    return NextResponse.json({ error: 'Station not found' }, { status: 404 });
  }

  // ── 1. Call OpenRouter image generation ──────────────────────────
  let orRes;
  try {
    orRes = await fetch(OPENROUTER_IMAGE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://station-exam-builder.vercel.app',
        'X-Title': 'Station Exam Builder',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: prompt.trim(),
        n: 1,
        size: '1024x1024',
      }),
    });
  } catch (err) {
    return NextResponse.json({ error: `OpenRouter request failed: ${err.message}` }, { status: 502 });
  }

  if (!orRes.ok) {
    const errText = await orRes.text();
    let errMsg;
    try { errMsg = JSON.parse(errText)?.error?.message || errText; } catch { errMsg = errText; }
    return NextResponse.json({ error: `OpenRouter error (${orRes.status}): ${errMsg}` }, { status: 502 });
  }

  const orData = await orRes.json();
  const generatedUrl = orData.data?.[0]?.url || orData.data?.[0]?.b64_json ? null : null;
  const b64 = orData.data?.[0]?.b64_json;
  const remoteUrl = orData.data?.[0]?.url;

  if (!remoteUrl && !b64) {
    return NextResponse.json({ error: 'No image returned from OpenRouter', raw: orData }, { status: 502 });
  }

  // ── 2. Get image bytes ────────────────────────────────────────────
  let imageBytes;
  let contentType = 'image/png';

  if (b64) {
    const binary = atob(b64);
    imageBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) imageBytes[i] = binary.charCodeAt(i);
  } else {
    const imgRes = await fetch(remoteUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Failed to download generated image from OpenRouter' }, { status: 502 });
    }
    contentType = imgRes.headers.get('content-type') || 'image/png';
    const buf = await imgRes.arrayBuffer();
    imageBytes = new Uint8Array(buf);
  }

  // ── 3. Upload to Supabase Storage ─────────────────────────────────
  const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
  const filename = `station-${stationId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, imageBytes, { contentType, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);

  // ── 4. Update station record ──────────────────────────────────────
  const { error: updateError } = await supabase
    .from('stations')
    .update({ image_url: publicUrl })
    .eq('id', stationId);

  if (updateError) {
    return NextResponse.json({ error: `DB update failed: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ imageUrl: publicUrl, model: IMAGE_MODEL });
}
