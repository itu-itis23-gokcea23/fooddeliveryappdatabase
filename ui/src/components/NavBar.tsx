import { NavLink, useNavigate } from 'react-router-dom';
import { clearAuth, getAuth, hasRole } from '../lib/auth';

export function NavBar() {
  const nav = useNavigate();
  const auth = getAuth();

  return (
    <div className="nav">
      <div className="container navInner">
        <div className="brand" onClick={() => nav('/')} style={{ cursor: 'pointer' }}>
          <div className="brandBadge" />
          <div>Yemeksepeti Clone</div>
        </div>

        <div className="navLinks">
          <NavLink to="/" className={({ isActive }) => `chip ${isActive ? 'chipActive' : ''}`}>
            Restaurants
          </NavLink>
          {hasRole('CUSTOMER') && (
            <NavLink to="/orders" className={({ isActive }) => `chip ${isActive ? 'chipActive' : ''}`}>
              My Orders
            </NavLink>
          )}

          {hasRole('RESTAURANT') && (
            <NavLink to="/owner" className={({ isActive }) => `chip ${isActive ? 'chipActive' : ''}`}>
              Owner Dashboard
            </NavLink>
          )}
          {hasRole('ADMIN') && (
            <NavLink to="/admin" className={({ isActive }) => `chip ${isActive ? 'chipActive' : ''}`}>
              Admin
            </NavLink>
          )}

          <div className="spacer" />

          {!auth ? (
            <>
              <NavLink to="/login" className={({ isActive }) => `chip ${isActive ? 'chipActive' : ''}`}>
                Login
              </NavLink>
              <NavLink to="/register" className={({ isActive }) => `chip ${isActive ? 'chipActive' : ''}`}>
                Register
              </NavLink>
            </>
          ) : (
            <>
              <span className="pill">{auth.user.email}</span>
              <button
                className="btn btnGhost"
                onClick={() => {
                  clearAuth();
                  nav('/login');
                }}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


