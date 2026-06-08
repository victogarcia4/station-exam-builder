/**
 * Seed Script for BIOL 2401
 * Populates Supabase database with BIOL 2401 question bank
 *
 * Run: node scripts/seed-biol2401.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Load question bank
const seedDataPath = join(__dirname, '../data/seed-biol2401.json');
const seedData = JSON.parse(readFileSync(seedDataPath, 'utf8'));

console.log('🚀 Starting BIOL 2401 database seed...\n');

async function seedDatabase() {
  try {
    // 1. Create BIOL2401 course
    console.log('📚 Creating BIOL 2401 course...');
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert({
        code: 'BIOL2401',
        name: 'Anatomy & Physiology I',
        station_count: 28,
        question_count: 105,
      })
      .select()
      .single();

    if (courseError) throw courseError;
    console.log(`✅ Course created: ${course.code} (${course.id})\n`);

    // 2. Create exam
    console.log('📋 Creating Lab Practical Exam #1...');
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .insert({
        course_id: course.id,
        title: 'Lab Practical Exam #1',
        version: 'v1.0',
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (examError) throw examError;
    console.log(`✅ Exam created: ${exam.title} (${exam.id})\n`);

    // 3. Group questions by station
    console.log('🗂️  Grouping questions by station...');
    const stationMap = new Map();

    for (const q of seedData) {
      if (!stationMap.has(q.s)) {
        stationMap.set(q.s, {
          number: q.s,
          exercise: q.ex,
          image_url: `/stations/BIOL 2401 Station ${q.s}.png`,
          image_description: q.stationImg || '',
          learning_objectives: [],
          questions: [],
        });
      }
      const station = stationMap.get(q.s);

      // Add unique learning objectives
      if (q.lo && !station.learning_objectives.includes(q.lo)) {
        station.learning_objectives.push(q.lo);
      }

      station.questions.push(q);
    }

    console.log(`✅ Organized ${stationMap.size} stations\n`);

    // 4. Insert stations and questions
    console.log('💾 Inserting stations and questions...');
    let totalQuestions = 0;

    for (const [stationNum, stationData] of stationMap) {
      // Insert station
      const { data: station, error: stationError } = await supabase
        .from('stations')
        .insert({
          exam_id: exam.id,
          number: stationData.number,
          exercise: stationData.exercise,
          image_url: stationData.image_url,
          image_description: stationData.image_description,
          learning_objectives: stationData.learning_objectives,
        })
        .select()
        .single();

      if (stationError) throw stationError;

      // Insert questions for this station
      const questionsToInsert = stationData.questions.map(q => ({
        station_id: station.id,
        question_number: q.q,
        stem: q.question,
        options: q.options,
        correct_answer: q.answer,
        rationale: q.rationale,
        bloom_level: q.bloom,
      }));

      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsToInsert);

      if (questionsError) throw questionsError;

      totalQuestions += questionsToInsert.length;
      console.log(`   ✓ Station ${stationNum}: ${questionsToInsert.length} questions`);
    }

    console.log(`\n✅ Total questions inserted: ${totalQuestions}`);

    // 5. Verify data
    console.log('\n🔍 Verifying database...');

    const { count: courseCount } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true });

    const { count: stationCount } = await supabase
      .from('stations')
      .select('*', { count: 'exact', head: true });

    const { count: questionCount } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true });

    console.log(`   • Courses: ${courseCount}`);
    console.log(`   • Stations: ${stationCount}`);
    console.log(`   • Questions: ${questionCount}`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('➡️  Next: Update app code to use Supabase\n');

  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

// Run the seed
seedDatabase();
