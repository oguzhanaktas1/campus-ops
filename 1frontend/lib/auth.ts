const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';
const SESSION_SENTINEL = 'cookie-session';

export interface StoredUser {
  id: string;
  email: string;
  role: string;
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

export function setAuth(_token: string | undefined, user: StoredUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', SESSION_SENTINEL);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
}

export function isTokenExpired(token: string): boolean {
  return token !== SESSION_SENTINEL && token.trim().length === 0;
}

export function getRoleFromToken(_token: string): string | null {
  return getStoredUser()?.role?.toUpperCase() ?? null;
}

async function parseError(res: Response, fallback: string) {
  const err = (await res.json().catch(() => null)) as { message?: string } | null;
  return err?.message ?? fallback;
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<{ access_token?: string; user: StoredUser }> {
  const res = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Login failed'));
  }
  return res.json() as Promise<{ access_token?: string; user: StoredUser }>;
}

export async function apiRegister(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ access_token?: string; user: StoredUser }> {
  const res = await fetch(`${BACKEND}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Registration failed'));
  }
  return res.json() as Promise<{ access_token?: string; user: StoredUser }>;
}

export async function apiLogout(): Promise<void> {
  await fetch(`${BACKEND}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await fetch(`${BACKEND}/auth/me`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Unauthorized');
  return res.json() as Promise<MeResponse>;
}

export async function fetchProfile(): Promise<Record<string, unknown>> {
  const res = await fetch(`${BACKEND}/auth/profile`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Unauthorized');
  return res.json() as Promise<Record<string, unknown>>;
}
