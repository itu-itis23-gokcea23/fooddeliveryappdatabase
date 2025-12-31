import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type RegisterMode = 'CUSTOMER' | 'RESTAURANT' | 'COURIER';

export function RegisterPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<RegisterMode>('CUSTOMER');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const body = { full_name: fullName, email, password, phone };
      if (mode === 'CUSTOMER') await api.registerCustomer(body);
      else if (mode === 'RESTAURANT') await api.registerRestaurant(body);
      else await api.registerCourier(body);
      setOk('Registered! Now login.');
      setTimeout(() => nav('/login'), 700);
    } catch (e: any) {
      setError(e?.message || e?.error || 'Register failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid2" style={{ marginTop: 16 }}>
      <div className="card">
        <h2 className="h1">Register</h2>
        <p className="muted">Create a customer, restaurant owner, or courier account.</p>

        <form onSubmit={onSubmit} className="grid" style={{ marginTop: 12 }}>
          <div>
            <div className="label">Register as</div>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="CUSTOMER">Customer</option>
              <option value="RESTAURANT">Restaurant Owner</option>
              <option value="COURIER">Courier</option>
            </select>
          </div>

          <div>
            <div className="label">Full name</div>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div>
            <div className="label">Email</div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <div className="label">Phone</div>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <div className="label">Password</div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <button className="btn btnPrimary" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </button>

          {error && <div className="err">{error}</div>}
          {ok && <div className="ok">{ok}</div>}
        </form>
      </div>

      <div className="card">
        <h2 className="h2">What you get</h2>
        <div className="grid">
          <div className="card" style={{ background: 'rgba(15,23,42,.55)' }}>
            <div className="row">
              <span className="pill pillOk">CUSTOMER</span>
              <span className="muted">Browse restaurants, create orders, pay, rate.</span>
            </div>
          </div>
          <div className="card" style={{ background: 'rgba(15,23,42,.55)' }}>
            <div className="row">
              <span className="pill pillWarn">RESTAURANT</span>
              <span className="muted">Create restaurant + menu items.</span>
            </div>
          </div>
          <div className="card" style={{ background: 'rgba(15,23,42,.55)' }}>
            <div className="row">
              <span className="pill">COURIER</span>
              <span className="muted">View assignments & update delivery status.</span>
            </div>
          </div>
          <div className="help">Admin accounts are created by role assignment.</div>
        </div>
      </div>
    </div>
  );
}


