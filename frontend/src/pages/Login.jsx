import { useState } from 'react';
import { api, setToken } from '../api/client.js';

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ email: 'admin@coal-tms.local', password: 'Admin@12345' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api('/auth/login', { method: 'POST', body: form });
      setToken(result.token);
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={submit} className="glass glass-card w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-coal">Coal TMS Login</h1>
        <p className="mt-2 text-sm text-slate-600">Manage trips, expenses, payments, and profit from one place.</p>
        {error && <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="mt-5 space-y-4">
          <div>
            <label>Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </div>
      </form>
    </main>
  );
}

