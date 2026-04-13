'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearAuth,
  fetchMe,
  getStoredUser,
  type MeResponse,
} from '@/lib/auth';

export type { MeResponse };

export interface UseCurrentUserResult {
  user: MeResponse | null;
  loading: boolean;
  error: string | null;
  primaryRole: string | null;
  refetch: () => void;
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      if (!getStoredUser()) {
        clearAuth();
        router.replace('/login');
        return;
      }

      try {
        const data = await fetchMe();
        if (!cancelled) setUser(data);
      } catch {
        if (!cancelled) {
          setError('Session expired. Please log in again.');
          clearAuth();
          router.replace('/login');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, tick]);

  const primaryRole =
    user?.roles?.find((r) => r.isPrimary)?.name ??
    user?.roles?.[0]?.name ??
    null;

  return { user, loading, error, primaryRole, refetch: () => setTick((t) => t + 1) };
}
