'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Chart from 'chart.js/auto';

// ── Chart helpers ─────────────────────────────────────────────────

const CHART_DEFAULTS = {
  color: '#8b95a5',
  grid: 'rgba(139,149,165,0.12)',
};

function ChartCanvas({ chartConfig, height = 280 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const dataKey = JSON.stringify(chartConfig?.data?.datasets?.map(d => d.data));

  useEffect(() => {
    if (!canvasRef.current || !chartConfig) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    chartRef.current = new Chart(canvasRef.current, chartConfig);
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [dataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

function ChartCard({ title, children, style }) {
  return (
    <div className="card" style={{ padding: '1.25rem', ...style }}>
      <h3 style={{ fontFamily: 'var(--ff-display)', fontSize: 'var(--fs-sm)', marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyChart({ message = 'Not enough data yet.' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
      {message}
    </div>
  );
}

// ── Other helpers ─────────────────────────────────────────────────

function fmt(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function bloomColor(level) {
  const map = { Remember: '#3b82f6', Understand: '#10b981', Apply: '#f59e0b', Analyze: '#8b5cf6', Evaluate: '#ec4899', Create: '#ef4444' };
  return map[level] || '#8b95a5';
}

const COURSE_COLORS = {
  BIOL2401: { bg: 'rgba(45,212,191,0.15)', text: '#2dd4bf' },
  BIOL2402: { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6' },
};

function CourseBadge({ code }) {
  const c = COURSE_COLORS[code] || { bg: 'rgba(139,149,165,0.15)', text: '#8b95a5' };
  return (
    <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: 'var(--fs-xs)', background: c.bg, color: c.text, fontWeight: 600 }}>
      {code}
    </span>
  );
}

function downloadCSV(attempts) {
  const header = ['Course', 'Name', 'Email', 'Section', 'Mode', 'Score', 'Total', 'Percent', 'Duration', 'Date'];
  const rows = attempts.map(a => [
    a.course_code || '',
    a.student_name,
    a.student_email,
    a.course_section || '',
    a.mode,
    a.score ?? '',
    a.total ?? '',
    a.percent != null ? `${a.percent}%` : '',
    fmt(a.duration_seconds),
    a.started_at ? new Date(a.started_at).toLocaleDateString() : '',
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `exam-attempts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Course filter pills ───────────────────────────────────────────

function CourseFilter({ value, onChange }) {
  const options = [
    { value: 'all', label: 'All Courses' },
    { value: 'BIOL2401', label: 'BIOL 2401' },
    { value: 'BIOL2402', label: 'BIOL 2402' },
  ];
  return (
    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
      {options.map(opt => {
        const active = value === opt.value;
        const c = COURSE_COLORS[opt.value];
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '0.35rem 0.9rem',
              borderRadius: '999px',
              fontSize: 'var(--fs-xs)',
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              border: `1px solid ${active && c ? c.text : 'var(--border-default)'}`,
              background: active && c ? c.bg : active ? 'var(--bg-card)' : 'transparent',
              color: active && c ? c.text : active ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'all 150ms',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Question Editor Modal ─────────────────────────────────────────

const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'];

function QuestionModal({ mode, stationId, stationLabel, question, onClose, onSaved }) {
  const [form, setForm] = useState({
    stem: question?.stem || '',
    optA: question?.options?.A || '',
    optB: question?.options?.B || '',
    optC: question?.options?.C || '',
    optD: question?.options?.D || '',
    correct_answer: question?.correct_answer || 'A',
    bloom_level: question?.bloom_level || 'Remember',
    rationale: question?.rationale || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key) { return e => setForm(f => ({ ...f, [key]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      stem: form.stem.trim(),
      options: { A: form.optA.trim(), B: form.optB.trim(), C: form.optC.trim(), D: form.optD.trim() },
      correct_answer: form.correct_answer,
      bloom_level: form.bloom_level,
      rationale: form.rationale.trim() || null,
    };
    try {
      const url = mode === 'edit' ? `/api/admin/questions/${question.id}` : '/api/admin/questions';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'edit' ? payload : { ...payload, station_id: stationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' };
  const labelStyle = { display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: '100%', maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--ff-display)', fontSize: 'var(--fs-xl)', margin: 0 }}>
              {mode === 'edit' ? 'Edit Question' : 'Add Question'}
            </h2>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{stationLabel}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Question Stem *</label>
            <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
              value={form.stem} onChange={set('stem')} required />
          </div>

          {['A','B','C','D'].map(l => (
            <div key={l} style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Option {l} *</label>
              <input type="text" style={inputStyle} value={form[`opt${l}`]} onChange={set(`opt${l}`)} required />
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '1.25rem 0' }}>
            <div>
              <label style={labelStyle}>Correct Answer *</label>
              <select style={inputStyle} value={form.correct_answer} onChange={set('correct_answer')}>
                {['A','B','C','D'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Bloom Level</label>
              <select style={inputStyle} value={form.bloom_level} onChange={set('bloom_level')}>
                {BLOOM_LEVELS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Rationale</label>
            <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
              value={form.rationale} onChange={set('rationale')} />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 'var(--fs-sm)', marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({ questionNum, stationNum, onConfirm, onCancel, loading, error }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🗑️</div>
        <h3 style={{ fontFamily: 'var(--ff-display)', marginBottom: '0.5rem' }}>Delete Question?</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: '1.5rem' }}>
          Station {stationNum} · Q{questionNum} — this cannot be undone.
        </p>
        {error && <p style={{ color: '#ef4444', fontSize: 'var(--fs-sm)', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={onConfirm} disabled={loading}
            style={{ background: '#ef4444', color: '#fff', border: 'none' }}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [charts, setCharts] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionModal, setQuestionModal] = useState(null); // { mode, stationId, stationLabel, question }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, questionNum, stationNum }
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [loading, setLoading] = useState(true);

  const [filterCourse, setFilterCourse] = useState('all');
  const [filterMode, setFilterMode] = useState('all');
  const [filterSection, setFilterSection] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async (type, course = 'all') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/data?type=${type}&course=${course}`);
      if (res.status === 401) { router.push('/admin'); return; }
      const json = await res.json();
      if (type === 'overview') setOverview(json);
      if (type === 'attempts') setAttempts(json.attempts || []);
      if (type === 'analytics') setAnalytics(json.questions || []);
      if (type === 'charts') setCharts(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchQuestions = useCallback(async (course) => {
    const target = course === 'all' ? 'BIOL2401' : course;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/questions?course=${target}`);
      if (res.status === 401) { router.push('/admin'); return; }
      const json = await res.json();
      setQuestions(json.stations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData('overview', 'all');
    fetchData('attempts', 'all');
  }, [fetchData]);

  useEffect(() => {
    if (tab === 'analytics' && analytics.length === 0) fetchData('analytics', filterCourse);
    if (tab === 'charts' && !charts) fetchData('charts', filterCourse);
    if (tab === 'questions') fetchQuestions(filterCourse);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData('overview', filterCourse);
    if (tab === 'charts') fetchData('charts', filterCourse);
    if (tab === 'analytics') { setAnalytics([]); fetchData('analytics', filterCourse); }
    if (tab === 'questions') fetchQuestions(filterCourse);
  }, [filterCourse]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = attempts.filter(a => {
    if (filterCourse !== 'all' && a.course_code !== filterCourse) return false;
    if (filterMode !== 'all' && a.mode !== filterMode) return false;
    if (filterSection && !a.course_section?.toLowerCase().includes(filterSection.toLowerCase())) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.student_name?.toLowerCase().includes(q) && !a.student_email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function handleDeleteQuestion() {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/admin/questions/${deleteConfirm.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setDeleteConfirm(null);
      fetchQuestions(filterCourse);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredAnalytics = filterCourse === 'all' ? analytics : analytics.filter(q => q.course_code === filterCourse);
  const uniqueSections = [...new Set(attempts.map(a => a.course_section).filter(Boolean))].sort();
  const courseLabel = filterCourse === 'all' ? 'All Courses' : filterCourse.replace('BIOL', 'BIOL ');

  // ── Build Chart.js configs ────────────────────────────────────────

  const scoreDistConfig = charts?.scoreDistribution?.length ? {
    type: 'bar',
    data: {
      labels: charts.scoreDistribution.map(b => b.label),
      datasets: [{
        label: 'Students',
        data: charts.scoreDistribution.map(b => b.count),
        backgroundColor: charts.scoreDistribution.map(b => b.passing ? '#10b981' : b.label.startsWith('6') ? '#f59e0b' : '#ef4444'),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: CHART_DEFAULTS.color, stepSize: 1 }, grid: { color: CHART_DEFAULTS.grid } },
        x: { ticks: { color: CHART_DEFAULTS.color, maxRotation: 45 }, grid: { display: false } },
      },
    },
  } : null;

  const modeConfig = (charts?.studyCount != null || charts?.examCount != null) ? {
    type: 'doughnut',
    data: {
      labels: ['Study', 'Exam'],
      datasets: [{
        data: [charts.studyCount || 0, charts.examCount || 0],
        backgroundColor: ['#10b981', '#f59e0b'],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: CHART_DEFAULTS.color, padding: 16 } } },
      cutout: '68%',
    },
  } : null;

  const stationConfig = charts?.stationDifficulty?.length ? {
    type: 'bar',
    data: {
      labels: charts.stationDifficulty.map(s => `St ${s.station}`),
      datasets: [{
        label: 'Error Rate %',
        data: charts.stationDifficulty.map(s => s.errorRate),
        backgroundColor: charts.stationDifficulty.map(s =>
          s.errorRate >= 60 ? 'rgba(239,68,68,0.75)' : s.errorRate >= 30 ? 'rgba(245,158,11,0.75)' : 'rgba(16,185,129,0.75)'
        ),
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw}% error rate` } } },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { color: CHART_DEFAULTS.color, callback: v => v + '%' }, grid: { color: CHART_DEFAULTS.grid } },
        x: { ticks: { color: CHART_DEFAULTS.color }, grid: { display: false } },
      },
    },
  } : null;

  const bloomConfig = charts?.bloomBreakdown?.length ? {
    type: 'bar',
    data: {
      labels: charts.bloomBreakdown.map(b => b.bloom),
      datasets: [
        { label: 'Correct %', data: charts.bloomBreakdown.map(b => 100 - b.errorRate), backgroundColor: 'rgba(16,185,129,0.75)', borderRadius: 3 },
        { label: 'Error %',   data: charts.bloomBreakdown.map(b => b.errorRate),        backgroundColor: 'rgba(239,68,68,0.75)',  borderRadius: 3 },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: CHART_DEFAULTS.color, padding: 16 } } },
      scales: {
        x: { stacked: true, max: 100, ticks: { color: CHART_DEFAULTS.color, callback: v => v + '%' }, grid: { color: CHART_DEFAULTS.grid } },
        y: { stacked: true, ticks: { color: CHART_DEFAULTS.color }, grid: { display: false } },
      },
    },
  } : null;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__title">Admin Dashboard</span>
          <span className="topbar__subtitle">Station Exam Builder · {courseLabel}</span>
        </div>
        <div className="topbar__meta" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => tab === 'questions' ? fetchQuestions(filterCourse) : fetchData(tab === 'charts' ? 'charts' : tab, filterCourse)}
            style={{ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', cursor: 'pointer' }}
          >
            Refresh
          </button>
          <a href="/" style={{ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
            ← Exit
          </a>
        </div>
      </header>

      <main className="main" style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
          {['overview', 'charts', 'attempts', 'analytics', 'questions'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                background: tab === t ? 'var(--bg-card)' : 'transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: tab === t ? 600 : 400,
                fontSize: 'var(--fs-sm)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >{t}</button>
          ))}
        </div>

        <CourseFilter value={filterCourse} onChange={setFilterCourse} />

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div>
            {loading ? <p style={{ color: 'var(--text-secondary)' }}>Loading...</p> : overview ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <StatCard label="Total Attempts" value={overview.total} icon="📋" />
                  <StatCard label="Study Sessions" value={overview.studyCount} icon="📖" color="#10b981" />
                  <StatCard label="Exam Sessions" value={overview.examCount} icon="⏱" color="#f59e0b" />
                  <StatCard label="Avg Score" value={`${overview.avgScore}%`} icon="📊" color={overview.avgScore >= 70 ? '#10b981' : '#ef4444'} />
                  <StatCard label="Pass Rate (≥70%)" value={`${overview.passRate}%`} icon="✅" color={overview.passRate >= 70 ? '#10b981' : '#ef4444'} />
                </div>
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--ff-display)', fontSize: 'var(--fs-md)', marginBottom: '1rem' }}>Quick Actions</h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button className="btn btn--primary" onClick={() => setTab('charts')}>View Charts</button>
                    <button className="btn btn--primary" onClick={() => setTab('attempts')}>All Attempts</button>
                    <button className="btn" onClick={() => setTab('analytics')}>Question Analytics</button>
                    <button className="btn" onClick={() => downloadCSV(filtered)}>Export CSV</button>
                  </div>
                </div>
              </>
            ) : <p style={{ color: 'var(--text-secondary)' }}>No data yet.</p>}
          </div>
        )}

        {/* ── CHARTS ── */}
        {tab === 'charts' && (
          <div>
            {loading && !charts ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading charts...</p>
            ) : !charts ? (
              <p style={{ color: 'var(--text-secondary)' }}>No data yet. Students need to complete exams first.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Row 1: Score Distribution + Mode Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
                  <ChartCard title="Score Distribution">
                    {scoreDistConfig
                      ? <ChartCanvas chartConfig={scoreDistConfig} height={260} />
                      : <EmptyChart />}
                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                      Green ≥ 70% · Yellow 60–69% · Red &lt; 60%
                    </p>
                  </ChartCard>

                  <ChartCard title="Study vs Exam Mode">
                    {modeConfig && (charts.studyCount + charts.examCount > 0)
                      ? <ChartCanvas chartConfig={modeConfig} height={220} />
                      : <EmptyChart />}
                    {charts && (
                      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: '0.5rem', textAlign: 'center' }}>
                        {charts.studyCount} study · {charts.examCount} exam
                      </p>
                    )}
                  </ChartCard>
                </div>

                {/* Row 2: Station Difficulty */}
                <ChartCard title={`Station Difficulty — Error Rate per Station (${courseLabel})`}>
                  {stationConfig
                    ? <ChartCanvas chartConfig={stationConfig} height={260} />
                    : <EmptyChart message="No station data yet." />}
                  <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                    Green &lt; 30% · Yellow 30–59% · Red ≥ 60% error rate
                  </p>
                </ChartCard>

                {/* Row 3: Bloom Breakdown */}
                <ChartCard title="Performance by Bloom's Taxonomy Level">
                  {bloomConfig
                    ? <ChartCanvas chartConfig={bloomConfig} height={240} />
                    : <EmptyChart message="No bloom data yet." />}
                </ChartCard>

              </div>
            )}
          </div>
        )}

        {/* ── ATTEMPTS ── */}
        {tab === 'attempts' && (
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" className="field__input" placeholder="Search name or email..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: '1', minWidth: '200px', maxWidth: '320px' }} />
              <select className="field__input" value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ width: 'auto' }}>
                <option value="all">All Modes</option>
                <option value="study">Study</option>
                <option value="exam">Exam</option>
              </select>
              <select className="field__input" value={filterSection} onChange={e => setFilterSection(e.target.value)} style={{ width: 'auto' }}>
                <option value="">All Sections</option>
                {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn--primary" onClick={() => downloadCSV(filtered)} style={{ marginLeft: 'auto' }}>
                Export CSV ({filtered.length})
              </button>
            </div>

            {loading ? <p style={{ color: 'var(--text-secondary)' }}>Loading...</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      {['Course', 'Name', 'Email', 'Section', 'Mode', 'Score', '%', 'Time', 'Date'].map(h => (
                        <th key={h} style={{ padding: '0.6rem 0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No attempts found.</td></tr>
                    ) : filtered.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '0.6rem 0.75rem' }}><CourseBadge code={a.course_code} /></td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>{a.student_name}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{a.student_email}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{a.course_section || '—'}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: 'var(--fs-xs)', background: a.mode === 'exam' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: a.mode === 'exam' ? '#f59e0b' : '#10b981' }}>{a.mode}</span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{a.score != null ? `${a.score}/${a.total}` : '—'}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: a.percent >= 70 ? '#10b981' : a.percent != null ? '#ef4444' : 'var(--text-secondary)' }}>
                          {a.percent != null ? `${a.percent}%` : '—'}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{fmt(a.duration_seconds)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(a.started_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginTop: '0.75rem' }}>
                  Showing {filtered.length} of {attempts.length} attempts
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── QUESTIONS ── */}
        {tab === 'questions' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: '1.5rem' }}>
              {filterCourse === 'all' ? 'Showing BIOL 2401 — select a specific course to edit BIOL 2402' : `Editing ${filterCourse.replace('BIOL', 'BIOL ')} questions`} · {questions.reduce((n, s) => n + s.questions.length, 0)} questions across {questions.length} stations
            </p>

            {loading ? <p style={{ color: 'var(--text-secondary)' }}>Loading…</p> : questions.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No stations found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {questions.map(station => (
                  <div key={station.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Station header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className="badge badge--station" style={{ minWidth: '3rem', textAlign: 'center' }}>St {station.number}</span>
                        <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{station.exercise}</span>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{station.questions.length} q</span>
                      </div>
                      <button
                        className="btn btn--primary"
                        style={{ padding: '0.3rem 0.75rem', fontSize: 'var(--fs-xs)' }}
                        onClick={() => setQuestionModal({ mode: 'create', stationId: station.id, stationLabel: `Station ${station.number} — ${station.exercise}`, question: null })}
                      >
                        + Add
                      </button>
                    </div>

                    {/* Questions list */}
                    {station.questions.length === 0 ? (
                      <p style={{ padding: '0.75rem 1.25rem', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>No questions yet.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                        <tbody>
                          {station.questions.map((q, qi) => (
                            <tr key={q.id} style={{ borderBottom: qi < station.questions.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <td style={{ padding: '0.6rem 1.25rem', color: 'var(--text-tertiary)', width: '3rem', fontWeight: 600 }}>Q{q.question_number}</td>
                              <td style={{ padding: '0.6rem 0.5rem', flex: 1 }}>
                                <span style={{ color: 'var(--text-primary)' }}>
                                  {q.stem?.length > 100 ? q.stem.slice(0, 100) + '…' : q.stem}
                                </span>
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 'var(--fs-xs)', padding: '0.15rem 0.4rem', borderRadius: '4px', background: `${bloomColor(q.bloom_level)}22`, color: bloomColor(q.bloom_level) }}>
                                  {q.bloom_level}
                                </span>
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Ans: <strong style={{ color: 'var(--accent)' }}>{q.correct_answer}</strong></span>
                              </td>
                              <td style={{ padding: '0.6rem 1.25rem 0.6rem 0.5rem', whiteSpace: 'nowrap' }}>
                                <button
                                  className="btn"
                                  style={{ padding: '0.25rem 0.6rem', fontSize: 'var(--fs-xs)', marginRight: '0.4rem' }}
                                  onClick={() => setQuestionModal({ mode: 'edit', stationId: station.id, stationLabel: `Station ${station.number} — ${station.exercise}`, question: q })}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn"
                                  style={{ padding: '0.25rem 0.6rem', fontSize: 'var(--fs-xs)', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}
                                  onClick={() => { setDeleteError(''); setDeleteConfirm({ id: q.id, questionNum: q.question_number, stationNum: station.number }); }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab === 'analytics' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: '1.5rem' }}>
              Top 20 most missed questions (min 3 attempts) · {courseLabel}
            </p>
            {loading ? <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
              : filteredAnalytics.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Not enough data yet.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredAnalytics.map((q, i) => (
                    <div key={`${q.course_code}-${q.question_number}`} className="card" style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={{ minWidth: '2rem', fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 'var(--fs-lg)', color: i < 3 ? '#ef4444' : 'var(--text-tertiary)' }}>
                          #{i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <CourseBadge code={q.course_code} />
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Station {q.station_number} · Q{q.question_number}</span>
                            <span style={{ fontSize: 'var(--fs-xs)', padding: '0.1rem 0.4rem', borderRadius: '4px', background: `${bloomColor(q.bloom_level)}22`, color: bloomColor(q.bloom_level) }}>{q.bloom_level}</span>
                          </div>
                          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                            {q.stem?.length > 120 ? q.stem.slice(0, 120) + '...' : q.stem}
                          </p>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                            <span>{q.total} attempts</span>
                            <span>{q.correct} correct</span>
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>{q.error_rate}% error rate</span>
                            <span>Correct: <strong style={{ color: 'var(--accent)' }}>{q.correct_answer}</strong></span>
                          </div>
                        </div>
                        <div style={{ minWidth: '80px', textAlign: 'right' }}>
                          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: q.error_rate >= 70 ? '#ef4444' : q.error_rate >= 40 ? '#f59e0b' : '#10b981' }}>{q.error_rate}%</div>
                          <div style={{ height: '4px', background: 'var(--bg-surface)', borderRadius: '2px', marginTop: '4px' }}>
                            <div style={{ height: '4px', borderRadius: '2px', width: `${q.error_rate}%`, background: q.error_rate >= 70 ? '#ef4444' : q.error_rate >= 40 ? '#f59e0b' : '#10b981' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}
      </main>

      {/* Question editor modal */}
      {questionModal && (
        <QuestionModal
          mode={questionModal.mode}
          stationId={questionModal.stationId}
          stationLabel={questionModal.stationLabel}
          question={questionModal.question}
          onClose={() => setQuestionModal(null)}
          onSaved={() => { setQuestionModal(null); fetchQuestions(filterCourse); }}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <DeleteConfirm
          questionNum={deleteConfirm.questionNum}
          stationNum={deleteConfirm.stationNum}
          onConfirm={handleDeleteQuestion}
          onCancel={() => { setDeleteConfirm(null); setDeleteError(''); }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color = 'var(--accent)' }) {
  return (
    <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, fontFamily: 'var(--ff-display)', color, marginBottom: '0.25rem' }}>{value}</div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}
