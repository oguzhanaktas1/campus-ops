/**
 * Shared auth utilities — token storage, API calls, expiry check.
 * Use these instead of direct localStorage calls across the app.
 */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

// ─── Token / storage helpers ─────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: StoredUser): void {
  localStorage.setItem('access_token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp: number };
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/** Extract primary role from token without a network call */
export function getRoleFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as {
      roles?: string[];
    };
    return payload.roles?.[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  email: string;
  role: string;    // primary role name (STUDENT | FACULTY | STAFF | ADMIN)
  roles: string[];
}

export interface MeResponse {
  id: string;
  email: string;
  status: string;
  profile: {
    firstName: string;
    lastName: string;
    fullName: string;
  } | null;
  roles: Array<{
    name: string;
    scopeType: string;
    facultyId: string | null;
    departmentId: string | null;
    unitId: string | null;
    isPrimary: boolean;
  }>;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ access_token: string; user: StoredUser }> {
  const res = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(err?.message ?? 'Login failed');
  }
  return res.json() as Promise<{ access_token: string; user: StoredUser }>;
}

export async function apiRegister(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ access_token: string; user: StoredUser }> {
  const res = await fetch(`${BACKEND}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(err?.message ?? 'Registration failed');
  }
  return res.json() as Promise<{ access_token: string; user: StoredUser }>;
}

export async function fetchMe(): Promise<MeResponse> {
  const token = getToken();
  if (!token) throw new Error('No token');
  const res = await fetch(`${BACKEND}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Unauthorized');
  return res.json() as Promise<MeResponse>;
}

/** Used by portal layouts that still rely on the flat profile shape */
export async function fetchProfile(): Promise<Record<string, unknown>> {
  const token = getToken();
  if (!token) throw new Error('No token');
  const res = await fetch(`${BACKEND}/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Unauthorized');
  return res.json() as Promise<Record<string, unknown>>;
}
