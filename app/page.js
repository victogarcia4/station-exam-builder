'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAvailableCourses, validateEmail } from '../lib/examData';

export default function LandingPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch available courses on mount
  useEffect(() => {
    async function loadCourses() {
      try {
        const coursesData = await getAvailableCourses();
        setCourses(coursesData);
      } catch (error) {
        console.error('Error loading courses:', error);
        // Fallback to BIOL2401 if fetch fails
        setCourses([{
          code: 'BIOL2401',
          name: 'Anatomy & Physiology I',
          stationCount: 28,
          questionCount: 105,
        }]);
      } finally {
        setLoading(false);
      }
    }
    loadCourses();
  }, []);

  const [form, setForm] = useState({
    name: '',
    email: '',
    course: 'BIOL2401',
    section: '',
    examDate: new Date().toISOString().slice(0, 10),
    mode: 'study',
  });

  const [errors, setErrors] = useState({});
  const [shaking, setShaking] = useState(false);

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: null }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      errs.name = 'Please enter your full name';
    }
    const emailResult = validateEmail(form.email);
    if (!emailResult.valid) {
      errs.email = emailResult.error;
    }
    if (!form.section.trim()) {
      errs.section = 'Section is required';
    }
    return errs;
  }

  function handleStart(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }

    const params = new URLSearchParams({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      course: form.course,
      section: form.section.trim(),
      date: form.examDate,
      mode: form.mode,
    });

    router.push(`/exam?${params.toString()}`);
  }

  const selectedCourse = courses.find(c => c.code === form.course) || courses[0];

  // Show loading state while fetching courses
  if (loading) {
    return (
      <div className="shell">
        <div className="main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__title">Station Exam Builder</span>
          <span className="topbar__subtitle">Built by Dr. Victor Garcia M</span>
        </div>
      </header>

      <main className="main">
        <section className="landing">
          {/* Hero Side */}
          <div className="landing__hero animate-in">
            <h1>A&P Lab Practical Exam</h1>
            <p>
              Master station-based practical exams with {selectedCourse.questionCount} questions
              across {selectedCourse.stationCount} stations. Study with instant feedback or
              simulate the real exam under timed conditions.
            </p>
            <div className="landing__stats-row">
              <div className="landing__stat-card animate-in animate-in--delay-1">
                <span className="landing__stat-number">{selectedCourse.stationCount}</span>
                <span className="landing__stat-label">Stations</span>
              </div>
              <div className="landing__stat-card animate-in animate-in--delay-2">
                <span className="landing__stat-number">{selectedCourse.questionCount}</span>
                <span className="landing__stat-label">Questions</span>
              </div>
              <div className="landing__stat-card animate-in animate-in--delay-3">
                <span className="landing__stat-number">2</span>
                <span className="landing__stat-label">Modes</span>
              </div>
            </div>
            <div className="landing__instructor animate-in animate-in--delay-4">
              <img
                className="landing__instructor-img"
                src="/VHGM  foto.jpg"
                alt="Dr. Victor Garcia M"
                width={64}
                height={64}
              />
              <span className="landing__instructor-name">
                Dr. Victor Garcia M<br />
                <small style={{ fontWeight: 400, opacity: 0.7 }}>Lone Star College</small>
              </span>
            </div>
          </div>

          {/* Form Side */}
          <form
            className={`card landing__panel animate-in animate-in--delay-2 ${shaking ? 'shake' : ''}`}
            onSubmit={handleStart}
            noValidate
          >
            <h2 style={{ fontFamily: 'var(--ff-display)', marginBottom: 'var(--sp-6)', fontSize: 'var(--fs-xl)' }}>
              Start Your Exam
            </h2>

            {/* Name */}
            <div className="field" style={{ marginBottom: 'var(--sp-4)' }}>
              <label className="field__label" htmlFor="student-name">Full Name</label>
              <input
                id="student-name"
                className={`field__input ${errors.name ? 'field__input--error' : ''}`}
                type="text"
                placeholder="Enter your full name"
                autoComplete="name"
                value={form.name}
                onChange={e => update('name', e.target.value)}
              />
              {errors.name && <span className="field__error">{errors.name}</span>}
            </div>

            {/* Email */}
            <div className="field" style={{ marginBottom: 'var(--sp-4)' }}>
              <label className="field__label" htmlFor="student-email">Lone Star College Email</label>
              <input
                id="student-email"
                className={`field__input ${errors.email ? 'field__input--error' : ''}`}
                type="email"
                placeholder="student@my.lonestar.edu"
                autoComplete="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
              />
              {errors.email && <span className="field__error">{errors.email}</span>}
            </div>

            {/* Course + Section row */}
            <div className="landing__form-grid" style={{ marginBottom: 'var(--sp-4)' }}>
              <div className="field">
                <label className="field__label" htmlFor="course-select">Course</label>
                <select
                  id="course-select"
                  className="field__input field__input--select"
                  value={form.course}
                  onChange={e => update('course', e.target.value)}
                >
                  {courses.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="section-number">Section</label>
                <input
                  id="section-number"
                  className={`field__input ${errors.section ? 'field__input--error' : ''}`}
                  type="text"
                  placeholder="e.g. 2401-001"
                  value={form.section}
                  onChange={e => update('section', e.target.value)}
                />
                {errors.section && <span className="field__error">{errors.section}</span>}
              </div>
            </div>

            {/* Date */}
            <div className="field" style={{ marginBottom: 'var(--sp-5)' }}>
              <label className="field__label" htmlFor="exam-date">Exam Date</label>
              <input
                id="exam-date"
                className="field__input"
                type="date"
                value={form.examDate}
                onChange={e => update('examDate', e.target.value)}
              />
            </div>

            {/* Mode Selection */}
            <div className="field" style={{ marginBottom: 'var(--sp-6)' }}>
              <label className="field__label">Mode</label>
              <div className="landing__mode-grid">
                <button
                  type="button"
                  className={`mode-card ${form.mode === 'study' ? 'mode-card--active' : ''}`}
                  onClick={() => update('mode', 'study')}
                  aria-pressed={form.mode === 'study'}
                >
                  <div className="mode-card__icon">📖</div>
                  <div className="mode-card__title">Study Guide</div>
                  <div className="mode-card__desc">
                    Free navigation, instant feedback with rationale after each answer.
                  </div>
                </button>
                <button
                  type="button"
                  className={`mode-card ${form.mode === 'exam' ? 'mode-card--active' : ''}`}
                  onClick={() => update('mode', 'exam')}
                  aria-pressed={form.mode === 'exam'}
                >
                  <div className="mode-card__icon">⏱️</div>
                  <div className="mode-card__title">Exam</div>
                  <div className="mode-card__desc">
                    {selectedCourse.questionCount}-minute timer, forward only, results at the end.
                  </div>
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="landing__actions">
              <span className="landing__stat">
                {selectedCourse.stationCount} stations · {selectedCourse.questionCount} questions
              </span>
              <button type="submit" className="btn btn--primary btn--lg" id="start-exam-btn">
                Start {form.mode === 'study' ? 'Study Guide' : 'Exam'} →
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
