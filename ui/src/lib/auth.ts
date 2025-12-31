export type Role = 'ADMIN' | 'RESTAURANT' | 'CUSTOMER' | 'COURIER';

export type AuthUser = {
  id: number;
  email: string;
  roles: Role[];
};

type StoredAuth = {
  token: string;
  user: AuthUser;
};

const KEY = 'ys_auth_v1';

export function getAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function setAuth(auth: StoredAuth) {
  localStorage.setItem(KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}

export function hasRole(role: Role): boolean {
  const a = getAuth();
  return !!a?.user?.roles?.includes(role);
}


