import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { hasRole } from '../lib/auth';

export function OwnerPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);

  const [rName, setRName] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrPostal, setAddrPostal] = useState('');

  const [categories, setCategories] = useState<any[]>([]);
  const [miName, setMiName] = useState('');
  const [miDesc, setMiDesc] = useState('');
  const [miPrice, setMiPrice] = useState('');
  const [miCategoryIds, setMiCategoryIds] = useState<number[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function refresh() {
    const [myR, cats] = await Promise.all([api.myRestaurants(), api.listCategories()]);
    setRestaurants(myR as any);
    setCategories(cats as any);
    const first = (myR as any[])[0];
    setSelectedRestaurantId(first?.id ?? null);
  }

  useEffect(() => {
    if (!hasRole('RESTAURANT')) return;
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasRole('RESTAURANT')) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2">Restaurant role required</div>
        <div className="muted">Login as a RESTAURANT owner to use this page.</div>
      </div>
    );
  }

  async function createRestaurant() {
    setError(null);
    setOk(null);
    try {
      const r: any = await api.addRestaurant({ name: rName, description: rDesc });
      setOk(`Restaurant created: ${r.id}`);
      setRName('');
      setRDesc('');
      await refresh();
      setSelectedRestaurantId(r.id);
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to create restaurant');
    }
  }

  async function saveAddress() {
    if (!selectedRestaurantId) return;
    setError(null);
    setOk(null);
    try {
      await api.upsertRestaurantAddress(selectedRestaurantId, { street: addrStreet, city: addrCity, postal_code: addrPostal });
      setOk('Address saved.');
      setAddrStreet('');
      setAddrCity('');
      setAddrPostal('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to save address');
    }
  }

  async function addMenuItem() {
    if (!selectedRestaurantId) return;
    setError(null);
    setOk(null);
    try {
      const body = {
        restaurant_id: selectedRestaurantId,
        name: miName,
        description: miDesc,
        price: Number(miPrice),
        category_ids: miCategoryIds,
      };
      const res: any = await api.addMenuItem(body);
      setOk(`Menu item created: ${res.menu_item.id}`);
      setMiName('');
      setMiDesc('');
      setMiPrice('');
      setMiCategoryIds([]);
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to add menu item');
    }
  }

  return (
    <div style={{ marginTop: 16 }} className="grid grid2">
      <div className="card">
        <div className="h1">Owner Dashboard</div>
        <div className="muted">Create restaurants, set address, and add menu items.</div>

        <div className="card" style={{ marginTop: 12, background: 'rgba(15,23,42,.55)' }}>
          <div className="h2">My Restaurants</div>
          <div className="row" style={{ marginTop: 10 }}>
            <select
              className="select"
              value={selectedRestaurantId ?? ''}
              onChange={(e) => setSelectedRestaurantId(Number(e.target.value))}
            >
              <option value="" disabled>
                Select…
              </option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} — {r.name}
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => refresh().catch(() => {})}>Refresh</button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12, background: 'rgba(15,23,42,.55)' }}>
          <div className="h2">Create Restaurant</div>
          <div className="grid" style={{ marginTop: 10 }}>
            <input className="input" placeholder="Name" value={rName} onChange={(e) => setRName(e.target.value)} />
            <textarea className="textarea" placeholder="Description" value={rDesc} onChange={(e) => setRDesc(e.target.value)} />
            <button className="btn btnPrimary" onClick={createRestaurant}>Create</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h1">Manage</div>

        <div className="card" style={{ marginTop: 12, background: 'rgba(15,23,42,.55)' }}>
          <div className="h2">Restaurant Address</div>
          <div className="help">Applies to selected restaurant_id.</div>
          <div className="grid" style={{ marginTop: 10 }}>
            <input className="input" placeholder="Street" value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} />
            <div className="grid grid2">
              <input className="input" placeholder="City" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
              <input className="input" placeholder="Postal code" value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} />
            </div>
            <button className="btn" onClick={saveAddress} disabled={!selectedRestaurantId}>
              Save Address
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12, background: 'rgba(15,23,42,.55)' }}>
          <div className="h2">Add Menu Item</div>
          <div className="help">Uses `POST /menu/menu-items/add` (with category_ids).</div>

          <div className="grid" style={{ marginTop: 10 }}>
            <input className="input" placeholder="Name" value={miName} onChange={(e) => setMiName(e.target.value)} />
            <input className="input" placeholder="Price (e.g. 120)" value={miPrice} onChange={(e) => setMiPrice(e.target.value)} />
            <textarea className="textarea" placeholder="Description" value={miDesc} onChange={(e) => setMiDesc(e.target.value)} />

            <div>
              <div className="label">Categories (optional)</div>
              <select
                className="select"
                multiple
                value={miCategoryIds.map(String)}
                onChange={(e) => {
                  const ids = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                  setMiCategoryIds(ids);
                }}
                style={{ minHeight: 120 }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} — {c.name}
                  </option>
                ))}
              </select>
              <div className="help">Hold Ctrl to select multiple.</div>
            </div>

            <button className="btn btnPrimary" onClick={addMenuItem} disabled={!selectedRestaurantId}>
              Add Menu Item
            </button>
          </div>
        </div>

        {error && <div className="err">{error}</div>}
        {ok && <div className="ok">{ok}</div>}
      </div>
    </div>
  );
}


