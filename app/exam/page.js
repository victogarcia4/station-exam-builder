'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getCourse, getStations, calculateScore, getBloomClass } from '../../lib/examData';
import { exportResultsPdf } from '../../lib/pdfExport';

function ExamContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse URL params
  const studentName = searchParams.get('name') || 'Student';
  const studentEmail = searchParams.get('email') || '';
  const courseCode = searchParams.get('course') || 'BIOL2401';
  const section = searchParams.get('section') || '';
  const examDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const mode = searchParams.get('mode') || 'study';

  // Load course data
  const course = getCourse(courseCode);
  const stations = getStations(course.bank);
  const totalStations = stations.length;
  const totalQuestions = course.bank.length;
  const examSeconds = totalQuestions * 60;

  // State
  const [screen, setScreen] = useState('station'); // 'station' | 'results'
  const [stationIndex, setStationIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(examSeconds);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  // Timer for exam mode
  useEffect(() => {
    if (mode !== 'exam') return;
    timerRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setScreen('results');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [mode]);

  // Stop timer when leaving
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = useCallback((secs) => {
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.max(0, secs) % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, []);

  // Handlers
  function choose(qid, letter) {
    setAnswers(prev => ({ ...prev, [String(qid)]: letter }));
  }

  function nextStation() {
    if (stationIndex < totalStations - 1) {
      setStationIndex(i => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setScreen('results');
    }
  }

  function prevStation() {
    if (mode !== 'study') return;
    if (stationIndex > 0) {
      setStationIndex(i => i - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleRestart() {
    router.push('/');
  }

  async function handleExportPdf() {
    const scoreData = calculateScore(course.bank, answers);
    await exportResultsPdf({
      student: studentName,
      email: studentEmail,
      section,
      examDate,
      course,
      scoreData,
    });
  }

  // Current station
  const station = stations[stationIndex];
  const answeredCount = Object.keys(answers).length;

  // Timer status
  const timerClass = remainingSeconds < 300 ? 'timer--danger' : remainingSeconds < 600 ? 'timer--warning' : '';

  // ──────────── RESULTS SCREEN ────────────
  if (screen === 'results') {
    const scoreData = calculateScore(course.bank, answers);
    const durationSecs = Math.round((Date.now() - startTimeRef.current) / 1000);
    const durationMin = Math.floor(durationSecs / 60);

    return (
      <div className="shell">
        <header className="topbar">
          <div className="topbar__brand">
            <span className="topbar__title">{course.label}</span>
            <span className="topbar__subtitle">Performance Report</span>
          </div>
        </header>
        <main className="main">
          <div className="results animate-in">
            {/* Score Card */}
            <div className="score-card">
              <div>
                <h1 className="score-card__title">Performance Report</h1>
                <div className="score-card__meta">
                  <strong>{studentName}</strong> · {studentEmail}<br />
                  Section {section} · {examDate} · {durationMin} min<br />
                  {scoreData.correct} of {scoreData.total} correct
                </div>
              </div>
              <div className={`score-card__score ${scoreData.percent < 70 ? 'score-card__score--low' : ''}`}>
                {scoreData.percent}%
              </div>
            </div>

            {/* Actions */}
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => window.print()}>🖨️ Print</button>
              <button className="btn btn--primary" onClick={handleExportPdf}>📄 Export PDF</button>
              <button className="btn" onClick={handleRestart}>↩️ Restart</button>
            </div>

            {/* Missed Questions */}
            <h2 className="section-title">
              {scoreData.missed.length > 0
                ? `Missed Questions (${scoreData.missed.length})`
                : 'Results'}
            </h2>

            {scoreData.missed.length === 0 ? (
              <div className="empty-state animate-in animate-in--delay-1">
                🎉 Perfect score! No missed questions. Excellent work.
              </div>
            ) : (
              <div className="missed-list">
                {scoreData.missed.map((q, i) => (
                  <article
                    key={q.q}
                    className="missed-card animate-in"
                    style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}
                  >
                    <div className="missed-card__header">
                      Station {q.s} · Question {q.q}
                      <span className={`badge badge--bloom ${getBloomClass(q.bloom)}`}
                            style={{ marginLeft: '8px' }}>
                        {q.bloom}
                      </span>
                    </div>
                    <p>{q.question}</p>
                    <p>
                      <strong style={{ color: 'var(--error)' }}>Your answer:</strong>{' '}
                      {q.selectedAnswer}
                    </p>
                    <p>
                      <strong style={{ color: 'var(--success)' }}>Correct:</strong>{' '}
                      {q.answer}. {q.options[q.answer]}
                    </p>
                    <p><strong>Learning Objective:</strong> {q.lo}</p>
                    <p><strong>Rationale:</strong> {q.rationale}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ──────────── STATION VIEW ────────────
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__title">{course.label}</span>
          <span className="topbar__subtitle">
            {mode === 'study' ? 'Study Guide' : 'Exam'} · Section {section} · Station {station.number} of {totalStations}
          </span>
        </div>
        <div className="topbar__meta">
          {mode === 'exam' && (
            <div className={`timer ${timerClass}`} aria-live="polite" aria-label="Time remaining">
              ⏱ {formatTime(remainingSeconds)}
            </div>
          )}
          <span className="badge">
            {answeredCount}/{totalQuestions}
          </span>
        </div>
      </header>

      <main className="main">
        {/* Progress Bar */}
        <div className="progress-bar" style={{ marginBottom: 'var(--sp-5)' }}>
          <div
            className="progress-bar__fill"
            style={{ width: `${((stationIndex + 1) / totalStations) * 100}%` }}
            role="progressbar"
            aria-valuenow={stationIndex + 1}
            aria-valuemin={1}
            aria-valuemax={totalStations}
            aria-label={`Station ${stationIndex + 1} of ${totalStations}`}
          />
        </div>

        {/* Station Header */}
        <div className="station-header">
          <div className="station-header__info">
            <div className="station-header__title">
              <span className="badge badge--station">Station {station.number}</span>
              <h1 className="station-header__name">{station.exercise}</h1>
            </div>
            <div className="station-header__objective">
              <strong>Learning Objective:</strong>{' '}
              {station.objectives.join(' | ')}
            </div>
          </div>
          <div className="station-header__progress">
            Station {station.number} / {totalStations}
          </div>
        </div>

        {/* Station Grid: Image + Questions */}
        <div className="station-grid">
          {/* Image */}
          <aside className="image-card">
            <img
              className="image-card__img"
              src={station.image}
              alt={station.imageDescription || `Station ${station.number} visual reference`}
              loading={stationIndex === 0 ? 'eager' : 'lazy'}
            />
            {mode === 'study' && station.imageDescription && (
              <div className="image-card__caption">{station.imageDescription}</div>
            )}
          </aside>

          {/* Questions */}
          <div>
            <div className="questions-list">
              {station.questions.map(q => {
                const userAnswer = answers[String(q.q)];
                const isAnswered = Boolean(userAnswer);
                const showFeedback = mode === 'study' && isAnswered;

                return (
                  <article key={q.q} className="question-card">
                    <div className="question-card__meta">
                      <span className="question-card__number">Question {q.q}</span>
                      <span className={`badge badge--bloom ${getBloomClass(q.bloom)}`}>
                        {q.bloom}
                      </span>
                    </div>
                    <div className="question-card__stem">{q.question}</div>
                    <div className="options-list" role="radiogroup" aria-label={`Options for question ${q.q}`}>
                      {'ABCD'.split('').map(letter => {
                        const isSelected = userAnswer === letter;
                        let cls = 'option';
                        if (isSelected) cls += ' option--selected';
                        if (showFeedback && letter === q.answer) cls += ' option--correct';
                        if (showFeedback && isSelected && letter !== q.answer) cls += ' option--incorrect';

                        return (
                          <button
                            key={letter}
                            type="button"
                            className={cls}
                            onClick={() => choose(q.q, letter)}
                            role="radio"
                            aria-checked={isSelected}
                            aria-label={`Option ${letter}: ${q.options[letter]}`}
                          >
                            <span className="option__letter">{letter}</span>
                            <span className="option__text">{q.options[letter]}</span>
                          </button>
                        );
                      })}
                    </div>

                    {showFeedback && (
                      <div className="feedback">
                        <div className="feedback__correct">
                          ✓ Correct answer: {q.answer}. {q.options[q.answer]}
                        </div>
                        <div className="feedback__rationale">{q.rationale}</div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="nav-bar">
              {mode === 'study' ? (
                <button
                  className="btn"
                  onClick={prevStation}
                  disabled={stationIndex === 0}
                  aria-label="Previous station"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}
              <button
                className="btn btn--primary btn--lg"
                onClick={nextStation}
                aria-label={stationIndex === totalStations - 1 ? 'Finish exam' : 'Next station'}
              >
                {stationIndex === totalStations - 1 ? 'Finish' : 'Next Station →'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ExamPage() {
  return (
    <Suspense fallback={
      <div className="shell">
        <main className="main" style={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔬</div>
            <p>Loading exam...</p>
          </div>
        </main>
      </div>
    }>
      <ExamContent />
    </Suspense>
  );
}
