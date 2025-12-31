import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { clearCart, cartTotal, getCart, setQuantity } from '../lib/cart';
import { getAuth, hasRole } from '../lib/auth';

type Address = {
  id: number;
  title: string;
  street: string;
  city: string;
  postal_code?: string;
  is_default?: boolean;
};

export function OrdersPage() {
  const auth = getAuth();
  const cart = getCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const [addrTitle, setAddrTitle] = useState('Home');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrPostal, setAddrPostal] = useState('');

  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [rateOrderId, setRateOrderId] = useState<number | null>(null);
  const [rateScore, setRateScore] = useState(5);
  const [rateComment, setRateComment] = useState('');

  const total = useMemo(() => cartTotal(cart), [cart]);

  async function refresh() {
    if (!auth) return;
    const [addr, orders] = await Promise.all([api.myAddresses(), api.myOrders()]);
    setAddresses(addr as any);
    setMyOrders(orders as any);

    const def = (addr as any[]).find((a) => a.is_default);
    setSelectedAddressId(def?.id || (addr as any[])[0]?.id || null);
  }

  useEffect(() => {
    setError(null);
    setOk(null);
    if (!auth) return;
    refresh().catch((e: any) => setError(e?.message || e?.error || 'Failed to load'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createAddress() {
    setError(null);
    setOk(null);
    try {
      await api.addAddress({ title: addrTitle, street: addrStreet, city: addrCity, postal_code: addrPostal, is_default: true });
      setAddrStreet('');
      setAddrCity('');
      setAddrPostal('');
      setOk('Address saved.');
      await refresh();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to add address');
    }
  }

  async function placeOrder() {
    if (!auth) return;
    setError(null);
    setOk(null);
    if (!cart || !cart.items.length) return setError('Cart is empty.');
    if (!selectedAddressId) return setError('Please select an address.');
    setPlacing(true);
    try {
      const payload = {
        restaurant_id: cart.restaurant_id,
        address_id: selectedAddressId,
        items: cart.items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
        payment_method: paymentMethod,
      };
      const res: any = await api.createOrder(payload);
      clearCart();
      setOk(`Order created (#${res.orderId}) — DELIVERED & PAID.`);
      await refresh();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to create order');
    } finally {
      setPlacing(false);
    }
  }

  async function submitRating() {
    if (!rateOrderId) return;
    setError(null);
    setOk(null);
    try {
      await api.addRating({ order_id: rateOrderId, score: rateScore, comment: rateComment });
      setOk(`Rating saved for order #${rateOrderId}.`);
      setRateOrderId(null);
      setRateScore(5);
      setRateComment('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to save rating');
    }
  }

  if (!auth) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2">Login required</div>
        <div className="muted">Please login as CUSTOMER to place orders.</div>
        <div style={{ marginTop: 10 }}>
          <Link className="btn btnPrimary" to="/login">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (!hasRole('CUSTOMER')) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2">Customer role required</div>
        <div className="muted">Only CUSTOMER users can create orders, add addresses, pay, and view order history.</div>
        <div className="help">Login as CUSTOMER from the Login page.</div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }} className="grid grid2">
      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Cart</div>
            <div className="muted">Simple checkout: select address → create order → pay.</div>
          </div>
          <div className="spacer" />
          <span className="pill pillOk">{total.toFixed(2)} ₺</span>
        </div>

        {!cart || !cart.items.length ? (
          <div className="card" style={{ marginTop: 12, background: 'rgba(15,23,42,.55)' }}>
            Cart is empty. Go to <Link to="/" className="chip">Restaurants</Link>
          </div>
        ) : (
          <div className="grid" style={{ marginTop: 12 }}>
            <div className="card" style={{ background: 'rgba(15,23,42,.55)' }}>
              <div className="row">
                <div className="cardTitle">{cart.restaurant_name}</div>
                <div className="spacer" />
                <span className="pill">restaurant_id: {cart.restaurant_id}</span>
              </div>
              <div className="grid" style={{ marginTop: 10 }}>
                {cart.items.map((i) => (
                  <div key={i.menu_item_id} className="row">
                    <div style={{ minWidth: 180 }}>
                      <div className="cardTitle" style={{ margin: 0 }}>{i.name}</div>
                      <div className="help">menu_item_id: {i.menu_item_id}</div>
                    </div>
                    <div className="spacer" />
                    <input
                      className="input"
                      style={{ width: 90 }}
                      type="number"
                      min={0}
                      value={i.quantity}
                      onChange={(e) => setQuantity(i.menu_item_id, Number(e.target.value || 0))}
                    />
                    <span className="pill pillOk">{(i.price * i.quantity).toFixed(2)} ₺</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ background: 'rgba(15,23,42,.55)' }}>
              <div className="h2">Address</div>
              <div className="help">Order requires an address_id that belongs to you.</div>

              <div style={{ marginTop: 10 }} className="grid">
                <select
                  className="select"
                  value={selectedAddressId ?? ''}
                  onChange={(e) => setSelectedAddressId(Number(e.target.value))}
                >
                  <option value="" disabled>
                    Select saved address…
                  </option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} — {a.street}, {a.city} {a.is_default ? '(default)' : ''}
                    </option>
                  ))}
                </select>

                <div className="grid grid2">
                  <div>
                    <div className="label">Title</div>
                    <input className="input" value={addrTitle} onChange={(e) => setAddrTitle(e.target.value)} />
                  </div>
                  <div>
                    <div className="label">Postal code</div>
                    <input className="input" value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid2">
                  <div>
                    <div className="label">Street</div>
                    <input className="input" value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} />
                  </div>
                  <div>
                    <div className="label">City</div>
                    <input className="input" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
                  </div>
                </div>
                <button className="btn" type="button" onClick={createAddress}>
                  Save as default address
                </button>
              </div>
            </div>

            <div className="card" style={{ background: 'rgba(15,23,42,.55)' }}>
              <div className="h2">Payment method</div>
              <div className="help">For demo, the backend immediately marks payment as COMPLETED.</div>
              <div style={{ marginTop: 10 }}>
                <select
                  className="select"
                  style={{ maxWidth: 260 }}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="CREDIT_CARD">CREDIT_CARD</option>
                  <option value="CASH">CASH</option>
                  <option value="WALLET">WALLET</option>
                </select>
              </div>
            </div>

            <button className="btn btnPrimary" disabled={placing} onClick={placeOrder}>
              {placing ? 'Placing…' : 'Place order'}
            </button>

            {error && <div className="err">{error}</div>}
            {ok && <div className="ok">{ok}</div>}
          </div>
        )}
      </div>

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">My Orders</div>
            <div className="muted">Your order history from the API.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={() => refresh().catch(() => {})}>Refresh</button>
        </div>

        <div className="grid" style={{ marginTop: 12 }}>
          {myOrders.map((o) => (
            <div key={o.id} className="card" style={{ background: 'rgba(15,23,42,.55)' }}>
              <div className="row">
                <div className="cardTitle">#{o.id} • {o.restaurant_name}</div>
                <div className="spacer" />
                <span className="pill">{o.status}</span>
                <span className="pill pillOk">{Number(o.total_amount).toFixed(2)} ₺</span>
              </div>
              <div className="help">created_at: {o.created_at}</div>

              {o.status === 'DELIVERED' && (
                <div style={{ marginTop: 10 }}>
                  {o.rating_id ? (
                    <div className="row">
                      <span className="pill pillOk">★ {o.rating_score}</span>
                      <span className="pill">Rated</span>
                      <div className="spacer" />
                      <span className="muted">{o.rating_comment || '—'}</span>
                    </div>
                  ) : (
                    <>
                      {rateOrderId !== o.id ? (
                        <button className="btn" onClick={() => setRateOrderId(o.id)}>
                          Rate this order
                        </button>
                      ) : (
                        <div className="card" style={{ background: 'rgba(11,15,23,.35)', borderColor: 'rgba(36,48,65,.6)' }}>
                          <div className="row">
                            <div className="h2">Rate order #{o.id}</div>
                            <div className="spacer" />
                            <button className="btn btnGhost" onClick={() => setRateOrderId(null)}>
                              Cancel
                            </button>
                          </div>
                          <div className="grid" style={{ marginTop: 10 }}>
                            <div className="grid grid2">
                              <div>
                                <div className="label">Score</div>
                                <select className="select" value={rateScore} onChange={(e) => setRateScore(Number(e.target.value))}>
                                  {[5, 4, 3, 2, 1].map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <div className="label">Comment</div>
                                <input className="input" value={rateComment} onChange={(e) => setRateComment(e.target.value)} placeholder="Optional" />
                              </div>
                            </div>
                            <button className="btn btnPrimary" onClick={submitRating}>
                              Submit rating
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {!myOrders.length && <div className="muted">No orders yet.</div>}
        </div>
      </div>
    </div>
  );
}


