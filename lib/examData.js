/**
 * Exam Data Module
 * Phase 2: Fetches data from Supabase
 */

import { supabase } from './supabase';

/**
 * Get course by code
 */
export async function getCourse(courseCode = 'BIOL2401') {
  const { data: course, error } = await supabase
    .from('courses')
    .select('*')
    .eq('code', courseCode)
    .single();

  if (error) {
    console.error('Error fetching course:', error);
    throw error;
  }

  return {
    code: course.code,
    name: course.name,
    label: `${course.code} · Lab Practical Exam #1`,
    stationCount: course.station_count,
    questionCount: course.question_count,
    examMinutes: course.question_count, // 1 minute per question
  };
}

/**
 * Get all available courses
 */
export async function getAvailableCourses() {
  const { data: courses, error } = await supabase
    .from('courses')
    .select('code, name, station_count, question_count')
    .order('code');

  if (error) {
    console.error('Error fetching courses:', error);
    return [];
  }

  return courses.map(c => ({
    code: c.code,
    name: c.name,
    stationCount: c.station_count,
    questionCount: c.question_count,
  }));
}

/**
 * Get exam with all stations and questions for a course
 */
export async function getExamData(courseCode = 'BIOL2401') {
  // 1. Get the course first
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, code, name')
    .eq('code', courseCode)
    .single();

  if (courseError) {
    console.error('Error fetching course:', courseError);
    throw courseError;
  }

  // 2. Get the exam for this course
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, title, version')
    .eq('course_id', course.id)
    .eq('status', 'published')
    .single();

  if (examError) {
    console.error('Error fetching exam:', examError);
    throw examError;
  }

  // 3. Get stations with questions
  const { data: stations, error: stationsError } = await supabase
    .from('stations')
    .select(`
      id,
      number,
      exercise,
      image_url,
      image_description,
      learning_objectives,
      questions(
        id,
        question_number,
        stem,
        options,
        correct_answer,
        rationale,
        bloom_level
      )
    `)
    .eq('exam_id', exam.id)
    .order('number');

  if (stationsError) {
    console.error('Error fetching stations:', stationsError);
    throw stationsError;
  }

  // 4. Transform to app format
  const transformedStations = stations.map(station => ({
    id: station.id,
    number: station.number,
    exercise: station.exercise,
    image: station.image_url,
    imageDescription: station.image_description || '',
    objectives: station.learning_objectives || [],
    questions: station.questions
      .sort((a, b) => a.question_number - b.question_number)
      .map(q => ({
        id: q.id,
        q: q.question_number,
        s: station.number,
        ex: station.exercise,
        lo: station.learning_objectives?.[0] || '',
        bloom: q.bloom_level,
        stationImg: station.image_description,
        question: q.stem,
        options: q.options,
        answer: q.correct_answer,
        rationale: q.rationale,
      })),
  }));

  // 5. Flatten questions for compatibility with existing code
  const allQuestions = transformedStations.flatMap(s => s.questions);

  return {
    examId: exam.id,
    stations: transformedStations,
    bank: allQuestions,
  };
}

/**
 * Calculate score from answers
 * (No change - doesn't need database)
 */
export function calculateScore(bank, answers) {
  let correct = 0;
  const missed = [];

  for (const q of bank) {
    const userAnswer = answers[String(q.q)];
    if (userAnswer === q.answer) {
      correct++;
    } else {
      missed.push({
        ...q,
        selectedAnswer: userAnswer || 'No answer',
      });
    }
  }

  return {
    correct,
    total: bank.length,
    percent: Math.round((correct / bank.length) * 1000) / 10,
    missed,
  };
}

/**
 * Validate Lone Star College email
 * (No change - doesn't need database)
 */
export function validateEmail(email) {
  if (!email) return { valid: false, error: 'Email is required' };
  const lower = email.toLowerCase().trim();
  if (!lower.includes('@')) return { valid: false, error: 'Invalid email format' };

  const domain = lower.split('@')[1];
  const validDomains = ['lonestar.edu', 'my.lonestar.edu'];

  if (!validDomains.includes(domain)) {
    return {
      valid: false,
      error: 'Please use your Lone Star College email (@lonestar.edu or @my.lonestar.edu)',
    };
  }

  return { valid: true, error: null };
}

/**
 * Get Bloom's badge class
 * (No change - doesn't need database)
 */
export function getBloomClass(bloom) {
  const map = {
    'Remember': 'badge--remember',
    'Understand': 'badge--understand',
    'Apply': 'badge--apply',
    'Analyze': 'badge--analyze',
    'Evaluate': 'badge--evaluate',
    'Create': 'badge--create',
  };
  return map[bloom] || 'badge--remember';
}

/**
 * Save student attempt
 */
export async function saveAttempt(attemptData) {
  const { data, error } = await supabase
    .from('attempts')
    .insert({
      exam_id: attemptData.examId,
      student_name: attemptData.studentName,
      student_email: attemptData.studentEmail,
      course_section: attemptData.section,
      mode: attemptData.mode,
      started_at: attemptData.startedAt,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving attempt:', error);
    throw error;
  }

  return data;
}

/**
 * Complete student attempt
 */
export async function completeAttempt(attemptId, scoreData, durationSeconds, answers, questions) {
  // 1. Update attempt with final score
  const { error: attemptError } = await supabase
    .from('attempts')
    .update({
      score: scoreData.correct,
      total: scoreData.total,
      percent: scoreData.percent,
      duration_seconds: durationSeconds,
      completed_at: new Date().toISOString(),
    })
    .eq('id', attemptId);

  if (attemptError) {
    console.error('Error completing attempt:', attemptError);
    throw attemptError;
  }

  // 2. Save individual answers
  const answersToInsert = Object.entries(answers).map(([qNum, selectedAnswer]) => {
    const question = questions.find(q => q.q === parseInt(qNum));
    return {
      attempt_id: attemptId,
      question_id: question.id,
      selected_answer: selectedAnswer,
      is_correct: selectedAnswer === question.answer,
    };
  });

  const { error: answersError } = await supabase
    .from('attempt_answers')
    .insert(answersToInsert);

  if (answersError) {
    console.error('Error saving answers:', answersError);
    throw answersError;
  }

  return true;
}
