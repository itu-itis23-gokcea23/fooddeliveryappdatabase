import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getAuth, hasRole } from '../lib/auth';
import { addToCart, cartTotal, getCart } from '../lib/cart';

type MenuItem = {
  id: number;
  name: string;
  description?: string;
  price: string | number;
  categories?: string[];
};

export function RestaurantPage() {
  const { id } = useParams();
  const restaurantId = Number(id);
  const auth = getAuth();
  const nav = useNavigate();

  const [restaurant, setRestaurant] = useState<any>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const avgRating = useMemo(() => {
    if (!ratings.length) return null;
    const sum = ratings.reduce((a, r) => a + Number(r.score || 0), 0);
    return (sum / ratings.length).toFixed(2);
  }, [ratings]);

  const cart = getCart();
  const cartIsThisRestaurant = cart?.restaurant_id === restaurantId;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await api.getRestaurant(restaurantId);
        const m = (await api.listMenuItemsByRestaurant(restaurantId)) as any[];
        const rt = (await api.ratingsByRestaurant(restaurantId)) as any[];
        setRestaurant(r);
        setMenu(m as any);
        setRatings(rt as any);
      } catch (e: any) {
        setError(e?.message || e?.error || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [restaurantId]);

  if (loading) return <div className="card" style={{ marginTop: 16 }}>Loading…</div>;
  if (error) return <div className="card" style={{ marginTop: 16 }}><div className="err">{error}</div></div>;

  return (
    <div style={{ marginTop: 16 }} className="grid" >
      <div className="row">
        <div>
          <div className="h1">{restaurant?.name}</div>
          <div className="muted">{restaurant?.description || '—'}</div>
          <div className="help">
            {restaurant?.street ? `${restaurant.street}${restaurant.city ? `, ${restaurant.city}` : ''}` : 'No address'}
          </div>
        </div>
        <div className="spacer" />
        <div className="row">
          <span className={`pill ${avgRating ? 'pillOk' : ''}`}>{avgRating ? `★ ${avgRating} (${ratings.length})` : 'No ratings'}</span>
          {hasRole('RESTAURANT') && <Link className="btn" to="/owner">Owner Dashboard</Link>}
          {!auth && <Link className="btn btnPrimary" to="/login">Login to order</Link>}
        </div>
      </div>

      <div className="grid grid2">
        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="h2">Menu</div>
            <div className="spacer" />
            <span className="pill">{menu.length} items</span>
          </div>
          <div className="grid">
            {menu.map((mi) => (
              <div key={mi.id} className="card" style={{ background: 'rgba(15,23,42,.55)' }}>
                <div className="row">
                  <div>
                    <div className="cardTitle">{mi.name}</div>
                    <div className="cardSub">{mi.description || '—'}</div>
                  </div>
                  <div className="spacer" />
                  <span className="pill pillOk">{Number(mi.price).toFixed(2)} ₺</span>
                </div>
                <div className="help">
                  {(mi.categories || []).filter(Boolean).join(', ') || 'No categories'}
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    className="btn btnPrimary"
                    disabled={!hasRole('CUSTOMER')}
                    onClick={() => {
                      addToCart({
                        restaurant_id: restaurantId,
                        restaurant_name: restaurant?.name || `Restaurant ${restaurantId}`,
                        menu_item_id: mi.id,
                        name: mi.name,
                        price: Number(mi.price),
                      });
                      nav('/orders');
                    }}
                  >
                    {hasRole('CUSTOMER') ? 'Add to cart' : 'Customer only'}
                  </button>
                  <div className="spacer" />
                  {cartIsThisRestaurant && (
                    <span className="pill">
                      Cart: {cart?.items?.length || 0} items • {cartTotal(cart).toFixed(2)} ₺
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="h2">Ratings</div>
            <div className="spacer" />
            <span className="pill">{ratings.length}</span>
          </div>
          <div className="grid">
            {ratings.slice(0, 10).map((r) => (
              <div key={r.id} className="card" style={{ background: 'rgba(15,23,42,.55)' }}>
                <div className="row">
                  <span className="pill pillOk">★ {r.score}</span>
                  <div className="spacer" />
                  <span className="pill">{r.customer_name || 'Customer'}</span>
                </div>
                <div className="help">{r.comment || '—'}</div>
              </div>
            ))}
            {!ratings.length && <div className="muted">No ratings yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}


