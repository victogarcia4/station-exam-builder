/**
 * Exam Data Module
 * Loads and organizes the question bank for a given course.
 * Phase 1: imports seed JSON directly.
 * Phase 2: will fetch from Supabase.
 */

import bankData from '../data/seed-biol2401.json';

const COURSES = {
  'BIOL2401': {
    code: 'BIOL2401',
    name: 'Anatomy & Physiology I',
    label: 'BIOL 2401 · Lab Practical Exam #1',
    stationCount: 28,
    questionCount: 105,
    examMinutes: 105,
    bank: bankData,
  },
  // BIOL2402 will be added in Phase 5
};

/**
 * Get course configuration
 */
export function getCourse(courseCode) {
  return COURSES[courseCode] || COURSES['BIOL2401'];
}

/**
 * Get all available courses
 */
export function getAvailableCourses() {
  return Object.values(COURSES).map(c => ({
    code: c.code,
    name: c.name,
    stationCount: c.stationCount,
    questionCount: c.questionCount,
  }));
}

/**
 * Organize bank into station groups
 */
export function getStations(bank) {
  const stationMap = new Map();

  for (const item of bank) {
    const num = item.s;
    if (!stationMap.has(num)) {
      stationMap.set(num, {
        number: num,
        exercise: item.ex,
        image: `/stations/BIOL 2401 Station ${num}.png`,
        imageDescription: item.stationImg || '',
        objectives: [],
        questions: [],
      });
    }
    const station = stationMap.get(num);
    station.questions.push(item);

    const lo = item.lo?.trim();
    if (lo && !station.objectives.includes(lo)) {
      station.objectives.push(lo);
    }
  }

  return Array.from(stationMap.values()).sort((a, b) => a.number - b.number);
}

/**
 * Calculate score from answers
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
