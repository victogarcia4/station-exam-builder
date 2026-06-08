'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/admin/dashboard');
    } else {
      setError('Incorrect password. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <div className="main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '380px', padding: '0 1rem' }}>
          <div className="card" style={{ padding: '2.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
              <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 'var(--fs-xl)', fontWeight: 700, marginBottom: '0.25rem' }}>
                Admin Access
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                Station Exam Builder
              </p>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="field">
                <label className="field__label">Password</label>
                <input
                  type="password"
                  className="field__input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoFocus
                  required
                />
              </div>

              {error && (
                <p style={{ color: 'var(--bloom-evaluate)', fontSize: 'var(--fs-sm)', textAlign: 'center' }}>
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn--primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
                {loading ? 'Verifying...' : 'Enter Dashboard'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
