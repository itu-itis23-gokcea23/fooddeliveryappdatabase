import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Restaurant = {
  id: number;
  name: string;
  description?: string;
  city?: string;
  street?: string;
};

export function RestaurantsPage() {
  const [items, setItems] = useState<Restaurant[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = (await api.listRestaurants()) as any[];
        setItems(res as any);
      } catch (e: any) {
        setError(e?.message || e?.error || 'Failed to load restaurants');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((r) => (r.name || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ marginTop: 16 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div>
          <div className="h1">Restaurants</div>
          <div className="muted">Browse and open a restaurant to see menu & ratings.</div>
        </div>
        <div className="spacer" />
        <input className="input" style={{ maxWidth: 320 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
      </div>

      {loading && <div className="card">Loading…</div>}
      {error && <div className="card"><div className="err">{error}</div></div>}

      <div className="grid grid3">
        {filtered.map((r) => (
          <Link key={r.id} to={`/restaurant/${r.id}`} className="card">
            <div className="row">
              <div>
                <div className="cardTitle">{r.name}</div>
                <p className="cardSub">{r.description || '—'}</p>
              </div>
              <div className="spacer" />
              <span className="pill">{r.city ? `${r.city}` : 'Open'}</span>
            </div>
            <div className="help">
              {r.street ? `${r.street}${r.city ? `, ${r.city}` : ''}` : 'No address'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}


