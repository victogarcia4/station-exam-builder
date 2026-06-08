/**
 * Fix BIOL 2402 station image_url values in Supabase
 * Changes: /stations/BIOL 2402 Station #N.png -> /stations/BIOL 2402 Station N.png
 *
 * Run: node --use-system-ca scripts/fix-biol2402-image-urls.js
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixImageUrls() {
  // Get BIOL2402 course
  const { data: course } = await supabase
    .from('courses').select('id').eq('code', 'BIOL2402').single();
  if (!course) { console.error('BIOL2402 not found'); process.exit(1); }

  // Get exam
  const { data: exam } = await supabase
    .from('exams').select('id').eq('course_id', course.id).single();
  if (!exam) { console.error('Exam not found'); process.exit(1); }

  // Get all stations for this exam
  const { data: stations } = await supabase
    .from('stations').select('id, number, image_url').eq('exam_id', exam.id);

  console.log(`Fixing ${stations.length} stations...`);

  for (const st of stations) {
    const newUrl = `/stations/BIOL 2402 Station ${st.number}.png`;
    if (st.image_url === newUrl) {
      console.log(`  Station ${st.number}: already correct`);
      continue;
    }
    const { error } = await supabase
      .from('stations').update({ image_url: newUrl }).eq('id', st.id);
    if (error) {
      console.error(`  Station ${st.number}: ERROR`, error.message);
    } else {
      console.log(`  Station ${st.number}: ${st.image_url} -> ${newUrl}`);
    }
  }

  console.log('\nDone!');
}

fixImageUrls();
