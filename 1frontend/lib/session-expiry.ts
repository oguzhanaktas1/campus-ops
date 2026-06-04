/**
 * Session expiry — single source of truth for "user is signed out".
 *
 * Responsibilities:
 *   1. Show a persistent, language-aware toast with a small close (✕) button.
 *   2. Clear locally cached auth state.
 *   3. Notify subscribed listeners (e.g. AuthGuard, portal layouts) so they
 *      can navigate the user to /login.
 *
 * The trigger is idempotent: even if 10 parallel fetches each see a 401 and
 * call `triggerSessionExpired()` at the same time, only one toast appears and
 * listeners are notified once.
 */

import { toast } from 'sonner'
import { clearAuth } from '@/lib/auth'

const I18N_STORAGE_KEY = 'campusops-locale'
const TOAST_ID = 'session-expired'

export type SessionExpiredReason = 'inactivity' | 'unauthorized' | 'manual'

let triggered = false
const listeners = new Set<(reason: SessionExpiredReason) => void>()

function getLocale(): 'tr' | 'en' {
  if (typeof window === 'undefined') return 'tr'
  try {
    const stored = window.localStorage.getItem(I18N_STORAGE_KEY)
    return stored === 'en' ? 'en' : 'tr'
  } catch {
    return 'tr'
  }
}

function getMessages(reason: SessionExpiredReason) {
  const locale = getLocale()
  if (locale === 'tr') {
    return {
      title: 'Oturum süreniz doldu',
      description:
        reason === 'inactivity'
          ? 'Uzun süredir hareketsiz olduğunuz için oturumunuz kapatıldı. Lütfen tekrar giriş yapın.'
          : 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.',
    }
  }
  return {
    title: 'Your session has expired',
    description:
      reason === 'inactivity'
        ? 'You have been signed out due to inactivity. Please log in again.'
        : 'Your session has expired. Please log in again.',
  }
}

/**
 * Subscribe to session-expired events. Returns an unsubscribe function.
 */
export function onSessionExpired(
  listener: (reason: SessionExpiredReason) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Triggers the session-expired flow. Idempotent — repeat calls within the same
 * page lifetime are no-ops. Returns true on the first call, false otherwise.
 */
export function triggerSessionExpired(
  reason: SessionExpiredReason = 'unauthorized',
): boolean {
  if (typeof window === 'undefined') return false
  if (triggered) return false
  triggered = true

  const { title, description } = getMessages(reason)

  // Persistent toast with a small ✕ close button (sonner renders closeButton
  // in the top-right corner of the toast). duration: Infinity = never auto-close.
  toast.error(title, {
    id: TOAST_ID,
    description,
    duration: Infinity,
    closeButton: true,
    dismissible: true,
  })

  // Wipe local auth state so any further fetch reads will see "not logged in".
  try {
    clearAuth()
  } catch {
    // ignore — non-critical, page navigation will follow
  }

  // Notify subscribers (AuthGuard, layouts) so they can navigate to /login.
  listeners.forEach((cb) => {
    try {
      cb(reason)
    } catch {
      // listener bugs shouldn't block redirect on the next listener
    }
  })

  return true
}

/**
 * Resets the idempotency guard. Call this on successful login so a subsequent
 * expiry within the same tab can fire again.
 */
export function resetSessionExpiry(): void {
  triggered = false
  // Also dismiss any lingering toast.
  if (typeof window !== 'undefined') {
    toast.dismiss(TOAST_ID)
  }
}
