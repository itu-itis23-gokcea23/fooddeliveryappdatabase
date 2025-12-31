import { Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { RestaurantsPage } from './pages/RestaurantsPage';
import { RestaurantPage } from './pages/RestaurantPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { OwnerPage } from './pages/OwnerPage';
import { OrdersPage } from './pages/OrdersPage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  return (
    <>
      <NavBar />
      <div className="container">
        <Routes>
          <Route path="/" element={<RestaurantsPage />} />
          <Route path="/restaurant/:id" element={<RestaurantPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/owner" element={<OwnerPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<div className="card">Not Found</div>} />
        </Routes>
      </div>
    </>
  );
}


