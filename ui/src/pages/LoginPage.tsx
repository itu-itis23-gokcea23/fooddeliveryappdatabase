import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { setAuth } from '../lib/auth';

type LoginMode = 'CUSTOMER' | 'RESTAURANT' | 'ADMIN' | 'COURIER';

export function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<LoginMode>('CUSTOMER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = { email, password };
      const res =
        mode === 'CUSTOMER'
          ? await api.loginCustomer(body)
          : mode === 'RESTAURANT'
            ? await api.loginRestaurant(body)
            : mode === 'ADMIN'
              ? await api.loginAdmin(body)
              : await api.loginCourier(body);

      setAuth(res as any);
      nav('/');
    } catch (e: any) {
      setError(e?.message || e?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid2" style={{ marginTop: 16 }}>
      <div className="card">
        <h2 className="h1">Login</h2>
        <p className="muted">Choose role login so the endpoint is strict and predictable.</p>

        <form onSubmit={onSubmit} className="grid" style={{ marginTop: 12 }}>
          <div>
            <div className="label">Login as</div>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="CUSTOMER">Customer</option>
              <option value="RESTAURANT">Restaurant Owner</option>
              <option value="COURIER">Courier</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <div className="label">Email</div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com" />
          </div>

          <div>
            <div className="label">Password</div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>

          <button className="btn btnPrimary" disabled={loading}>
            {loading ? 'Logging in…' : 'Login'}
          </button>

          {error && <div className="err">{error}</div>}
          <div className="help">Backend base: {api.base}</div>
        </form>
      </div>

      <div className="card">
        <h2 className="h2">Tip</h2>
        <p className="muted">
          If you can’t login as RESTAURANT/ADMIN/COURIER, make sure that user has that role in the DB (via your admin
          endpoint).
        </p>
      </div>
    </div>
  );
}


