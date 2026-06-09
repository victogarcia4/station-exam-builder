import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
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

function truncate(str, max = 400) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max) + '…';
}

// Extract image data from OpenRouter response (handles multiple formats)
function extractImage(orData) {
  // Format 1: images/generations response — { data: [{ url, b64_json }] }
  const imgData = orData.data?.[0];
  if (imgData?.url) return { remoteUrl: imgData.url, b64: null };
  if (imgData?.b64_json) return { remoteUrl: null, b64: imgData.b64_json };

  // Format 2: chat/completions response — content is string or array
  const content = orData.choices?.[0]?.message?.content;
  if (!content) return null;

  if (typeof content === 'string') {
    if (content.startsWith('data:image')) {
      return { remoteUrl: null, b64: content.split(',')[1] };
    }
    if (content.startsWith('http')) return { remoteUrl: content, b64: null };
  }

  if (Array.isArray(content)) {
    const item = content.find(c => c.type === 'image_url');
    const url = item?.image_url?.url;
    if (!url) return null;
    if (url.startsWith('data:image')) return { remoteUrl: null, b64: url.split(',')[1] };
    return { remoteUrl: url, b64: null };
  }

  return null;
}

// POST /api/admin/generate-image
// Body: { stationId: string, prompt: string }
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
  }

  const supabase = getSupabase();
  const { stationId, prompt } = await request.json();

  if (!stationId || !prompt?.trim()) {
    return NextResponse.json({ error: 'stationId and prompt are required' }, { status: 400 });
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://station-exam-builder.vercel.app',
    'X-Title': 'Station Exam Builder',
  };

  // ── 1. Try images/generations endpoint first ──────────────────────
  let orData = null;
  let usedEndpoint = 'images';

  try {
    const res = await fetch(`${OPENROUTER_BASE}/images/generations`, {
      method: 'POST', headers,
      body: JSON.stringify({ model: IMAGE_MODEL, prompt: prompt.trim(), n: 1, size: '1024x1024' }),
    });

    if (res.ok) {
      orData = await res.json();
    } else {
      const txt = await res.text();
      console.log(`[generate-image] images endpoint failed (${res.status}):`, truncate(txt, 500));
    }
  } catch (err) {
    console.log('[generate-image] images endpoint error:', err.message);
  }

  // ── 2. Fallback: chat/completions endpoint (native Flux format) ───
  if (!orData || !extractImage(orData)) {
    usedEndpoint = 'chat';
    try {
      const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST', headers,
        body: JSON.stringify({
          model: IMAGE_MODEL,
          messages: [{ role: 'user', content: prompt.trim() }],
        }),
      });

      if (res.ok) {
        orData = await res.json();
        console.log('[generate-image] chat endpoint raw response:', JSON.stringify(orData).slice(0, 300));
      } else {
        const txt = await res.text();
        let msg;
        try { msg = JSON.parse(txt)?.error?.message; } catch { msg = null; }
        return NextResponse.json(
          { error: `OpenRouter error (${res.status}): ${msg || truncate(txt)}` },
          { status: 502 }
        );
      }
    } catch (err) {
      return NextResponse.json({ error: `OpenRouter request failed: ${err.message}` }, { status: 502 });
    }
  }

  const extracted = extractImage(orData);
  if (!extracted) {
    console.log('[generate-image] Unexpected response structure:', JSON.stringify(orData).slice(0, 500));
    return NextResponse.json(
      { error: 'OpenRouter did not return an image. Check server logs for the full response.' },
      { status: 502 }
    );
  }

  const { remoteUrl, b64 } = extracted;

  // ── 3. Get image bytes ────────────────────────────────────────────
  let imageBytes;
  let contentType = 'image/png';

  if (b64) {
    const binary = atob(b64);
    imageBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) imageBytes[i] = binary.charCodeAt(i);
  } else {
    const imgRes = await fetch(remoteUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Failed to download generated image' }, { status: 502 });
    }
    contentType = imgRes.headers.get('content-type') || 'image/png';
    imageBytes = new Uint8Array(await imgRes.arrayBuffer());
  }

  // ── 4. Upload to Supabase Storage (fallback to direct URL) ────────
  const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
  const filename = `station-${stationId}-${Date.now()}.${ext}`;
  let finalUrl = remoteUrl;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, imageBytes, { contentType, upsert: true });

  if (!uploadError) {
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    finalUrl = publicUrl;
  } else {
    console.log('[generate-image] Storage upload failed (using direct URL):', uploadError.message);
  }

  // ── 5. Update station record ──────────────────────────────────────
  const { error: updateError } = await supabase
    .from('stations')
    .update({ image_url: finalUrl })
    .eq('id', stationId);

  if (updateError) {
    return NextResponse.json({ error: `DB update failed: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({
    imageUrl: finalUrl,
    model: IMAGE_MODEL,
    endpoint: usedEndpoint,
    stored: !uploadError ? 'supabase' : 'direct-url',
  });
}
