import { getAuth } from './auth';

export type ApiError = { error?: string; message?: string } & Record<string, any>;

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = getAuth();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as any),
  };
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw (data || { error: 'Request failed' }) as ApiError;
  return data as T;
}

export const api = {
  base: API_BASE,

  // Auth
  registerCustomer: (body: any) => request('/auth/register/customer', { method: 'POST', body: JSON.stringify(body) }),
  registerRestaurant: (body: any) => request('/auth/register/restaurant', { method: 'POST', body: JSON.stringify(body) }),
  registerCourier: (body: any) => request('/auth/register/courier', { method: 'POST', body: JSON.stringify(body) }),
  loginCustomer: (body: any) => request('/auth/login/customer', { method: 'POST', body: JSON.stringify(body) }),
  loginRestaurant: (body: any) => request('/auth/login/restaurant', { method: 'POST', body: JSON.stringify(body) }),
  loginAdmin: (body: any) => request('/auth/login/admin', { method: 'POST', body: JSON.stringify(body) }),
  loginCourier: (body: any) => request('/auth/login/courier', { method: 'POST', body: JSON.stringify(body) }),

  // Admin
  seedRoles: () => request('/admin/seed-roles', { method: 'POST' }),
  assignRole: (body: any) => request('/admin/assign-role', { method: 'POST', body: JSON.stringify(body) }),

  // Restaurants
  listRestaurants: () => request('/restaurants/list'),
  myRestaurants: () => request('/restaurants/my'),
  getRestaurant: (id: number) => request(`/restaurants/${id}`),
  addRestaurant: (body: any) => request('/restaurants/add', { method: 'POST', body: JSON.stringify(body) }),
  updateRestaurant: (id: number, body: any) => request(`/restaurants/${id}/update`, { method: 'PUT', body: JSON.stringify(body) }),
  upsertRestaurantAddress: (id: number, body: any) =>
    request(`/restaurants/${id}/address/add`, { method: 'POST', body: JSON.stringify(body) }),

  // Menu
  listCategories: () => request('/menu/categories'),
  createCategory: (body: any) => request('/menu/categories', { method: 'POST', body: JSON.stringify(body) }),
  listMenuItemsByRestaurant: (restaurantId: number) => request(`/menu/menu-items/by-restaurant/${restaurantId}`),
  addMenuItem: (body: any) => request('/menu/menu-items/add', { method: 'POST', body: JSON.stringify(body) }),
  updateMenuItem: (menuItemId: number, body: any) =>
    request(`/menu/menu-items/${menuItemId}/update`, { method: 'PUT', body: JSON.stringify(body) }),
  linkCategoryToMenuItem: (menuItemId: number, body: any) =>
    request(`/menu/menu-items/${menuItemId}/categories/add`, { method: 'POST', body: JSON.stringify(body) }),

  // Orders
  createOrder: (body: any) => request('/orders/add', { method: 'POST', body: JSON.stringify(body) }),
  myOrders: () => request('/orders/me'),

  // Payments
  pay: (body: any) => request('/payments/pay', { method: 'POST', body: JSON.stringify(body) }),
  paymentByOrder: (orderId: number) => request(`/payments/by-order/${orderId}`),

  // Ratings
  addRating: (body: any) => request('/ratings/add', { method: 'POST', body: JSON.stringify(body) }),
  ratingsByRestaurant: (restaurantId: number) => request(`/ratings/by-restaurant/${restaurantId}`),

  // Users
  myAddresses: () => request('/users/addresses/me'),
  addAddress: (body: any) => request('/users/addresses/add', { method: 'POST', body: JSON.stringify(body) }),

  // Courier
  assignCourier: (body: any) => request('/courier/assign-courier', { method: 'POST', body: JSON.stringify(body) }),
  myAssignments: () => request('/courier/assignments'),
  updateAssignmentStatus: (id: number, body: any) =>
    request(`/courier/assignments/${id}/update-status`, { method: 'PUT', body: JSON.stringify(body) }),
};


