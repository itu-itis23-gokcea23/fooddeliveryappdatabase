import { useState } from 'react';
import { api } from '../lib/api';
import { hasRole } from '../lib/auth';

export function AdminPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('RESTAURANT');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function seedRoles() {
    setError(null);
    setOk(null);
    try {
      await api.seedRoles();
      setOk('Roles seeded (idempotent).');
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to seed roles');
    }
  }

  async function assignRole() {
    setError(null);
    setOk(null);
    try {
      await api.assignRole({ email, role });
      setOk(`Assigned ${role} to ${email} (idempotent).`);
      setEmail('');
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed');
    }
  }

  if (!hasRole('ADMIN')) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2">Admin role required</div>
        <div className="muted">Login as ADMIN to use role assignment.</div>
      </div>
    );
  }

  return (
    <div className="grid grid2" style={{ marginTop: 16 }}>
      <div className="card">
        <div className="h1">Admin</div>
        <div className="muted">Assign roles to users.</div>

        <div className="card" style={{ marginTop: 12, background: 'rgba(15,23,42,.55)' }}>
          <div className="row">
            <div className="h2">Setup</div>
            <div className="spacer" />
            <button className="btn" onClick={seedRoles}>
              Seed roles
            </button>
          </div>
          <div className="help">Safe to run multiple times.</div>
        </div>

        <div className="card" style={{ marginTop: 12, background: 'rgba(15,23,42,.55)' }}>
          <div className="h2">Assign Role</div>
          <div className="grid" style={{ marginTop: 10 }}>
            <div>
              <div className="label">User email</div>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <div className="label">Role</div>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="RESTAURANT">RESTAURANT</option>
                <option value="CUSTOMER">CUSTOMER</option>
                <option value="COURIER">COURIER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <button className="btn btnPrimary" onClick={assignRole}>
              Assign
            </button>
          </div>
        </div>

        {error && <div className="err">{error}</div>}
        {ok && <div className="ok">{ok}</div>}
      </div>

      <div className="card">
        <div className="h2">Notes</div>
        <div className="muted">
          After assigning role, user should login using the correct login endpoint (e.g. <code>/auth/login/restaurant</code>).
        </div>
      </div>
    </div>
  );
}


