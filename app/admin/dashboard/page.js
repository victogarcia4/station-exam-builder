'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ── Helpers ──────────────────────────────────────────────────────

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

// ── Main Component ────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Initial load
  useEffect(() => {
    fetchData('overview', 'all');
    fetchData('attempts', 'all');
  }, [fetchData]);

  useEffect(() => {
    if (tab === 'analytics' && analytics.length === 0) fetchData('analytics', 'all');
  }, [tab, analytics.length, fetchData]);

  // Re-fetch overview when course filter changes
  useEffect(() => {
    fetchData('overview', filterCourse);
  }, [filterCourse, fetchData]);

  // Client-side filtering for attempts
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

  // Client-side filtering for analytics
  const filteredAnalytics = filterCourse === 'all'
    ? analytics
    : analytics.filter(q => q.course_code === filterCourse);

  const uniqueSections = [...new Set(attempts.map(a => a.course_section).filter(Boolean))].sort();

  const courseLabel = filterCourse === 'all' ? 'All Courses' : filterCourse.replace('BIOL', 'BIOL ');

  return (
    <div className="shell">
      {/* Top Bar */}
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__title">Admin Dashboard</span>
          <span className="topbar__subtitle">Station Exam Builder · {courseLabel}</span>
        </div>
        <div className="topbar__meta" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => fetchData(tab, filterCourse)}
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
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0' }}>
          {['overview', 'attempts', 'analytics'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
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
            >
              {t}
            </button>
          ))}
        </div>

        {/* Course filter — shown on all tabs */}
        <CourseFilter value={filterCourse} onChange={setFilterCourse} />

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div>
            {loading ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            ) : overview ? (
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
                    <button className="btn btn--primary" onClick={() => setTab('attempts')}>View All Attempts</button>
                    <button className="btn" onClick={() => setTab('analytics')}>Question Analytics</button>
                    <button className="btn" onClick={() => downloadCSV(filtered)}>
                      Export CSV
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>No data yet.</p>
            )}
          </div>
        )}

        {/* ── ATTEMPTS TAB ── */}
        {tab === 'attempts' && (
          <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="field__input"
                placeholder="Search name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: '1', minWidth: '200px', maxWidth: '320px' }}
              />
              <select
                className="field__input"
                value={filterMode}
                onChange={e => setFilterMode(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="all">All Modes</option>
                <option value="study">Study</option>
                <option value="exam">Exam</option>
              </select>
              <select
                className="field__input"
                value={filterSection}
                onChange={e => setFilterSection(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="">All Sections</option>
                {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn--primary" onClick={() => downloadCSV(filtered)} style={{ marginLeft: 'auto' }}>
                Export CSV ({filtered.length})
              </button>
            </div>

            {loading ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            ) : (
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
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <CourseBadge code={a.course_code} />
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>{a.student_name}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{a.student_email}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)' }}>{a.course_section || '—'}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: 'var(--fs-xs)',
                            background: a.mode === 'exam' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                            color: a.mode === 'exam' ? '#f59e0b' : '#10b981',
                          }}>{a.mode}</span>
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

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: '1.5rem' }}>
              Top 20 most missed questions (minimum 3 attempts) · {courseLabel}
            </p>
            {loading ? (
              <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            ) : filteredAnalytics.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Not enough data yet. Students need to complete exams first.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredAnalytics.map((q, i) => (
                  <div key={`${q.course_code}-${q.question_number}`} className="card" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      {/* Rank */}
                      <div style={{ minWidth: '2rem', fontFamily: 'var(--ff-display)', fontWeight: 800, fontSize: 'var(--fs-lg)', color: i < 3 ? '#ef4444' : 'var(--text-tertiary)' }}>
                        #{i + 1}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <CourseBadge code={q.course_code} />
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                            Station {q.station_number} · Q{q.question_number}
                          </span>
                          <span style={{ fontSize: 'var(--fs-xs)', padding: '0.1rem 0.4rem', borderRadius: '4px', background: `${bloomColor(q.bloom_level)}22`, color: bloomColor(q.bloom_level) }}>
                            {q.bloom_level}
                          </span>
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

                      {/* Error rate bar */}
                      <div style={{ minWidth: '80px', textAlign: 'right' }}>
                        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: q.error_rate >= 70 ? '#ef4444' : q.error_rate >= 40 ? '#f59e0b' : '#10b981' }}>
                          {q.error_rate}%
                        </div>
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
    </div>
  );
}

function StatCard({ label, value, icon, color = 'var(--accent)' }) {
  return (
    <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, fontFamily: 'var(--ff-display)', color, marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}
