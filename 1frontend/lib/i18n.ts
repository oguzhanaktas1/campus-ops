// ─── Desteklenen diller ────────────────────────────────────────────────────
export type Locale = 'tr' | 'en'
export const LOCALES: Locale[] = ['tr', 'en']
export const DEFAULT_LOCALE: Locale = 'en'  // Kaynak dil İngilizce

export const LOCALE_LABELS: Record<Locale, { label: string; flag: string }> = {
  tr: { label: 'Türkçe', flag: '🇹🇷' },
  en: { label: 'English', flag: '🇬🇧' },
}

// ─── Cookie sabitleri ──────────────────────────────────────────────────────
export const LANG_COOKIE  = 'cf_lang'
export const THEME_COOKIE = 'cf_theme'

// ─── Cookie yardımcıları ───────────────────────────────────────────────────
export function cookieGet(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : null
}

export function cookieSet(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return
  const exp = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value};expires=${exp};path=/;SameSite=Lax`
}

export function cookieDel(name: string) {
  if (typeof document === 'undefined') return
  const exp = 'Thu, 01 Jan 1970 00:00:00 UTC'
  document.cookie = `${name}=;expires=${exp};path=/`
  // Alt alan adı için de sil
  if (window.location.hostname !== 'localhost') {
    document.cookie = `${name}=;expires=${exp};path=/;domain=.${window.location.hostname}`
  }
}

// ─── Dil tercihi ──────────────────────────────────────────────────────────

/** Cookie'den kayıtlı dili oku; yoksa EN (projenin ana dili) */
export function getSavedLocale(): Locale {
  const saved = cookieGet(LANG_COOKIE) as Locale | null
  if (saved === 'tr' || saved === 'en') return saved
  return DEFAULT_LOCALE // 'en'
}

// ─── Google Translate yardımcıları ────────────────────────────────────────

/** googtrans cookie'sini set eder (Google Translate'in okuyacağı format: /en/tr) */
export function setGoogleTransCookie(from: string, to: string) {
  const val = `/${from}/${to}`
  cookieSet('googtrans', val, 1)
  // Google bazı tarayıcılarda domain cookie'sine de bakıyor
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    document.cookie = `googtrans=${val};path=/;domain=.${window.location.hostname};SameSite=Lax`
  }
}

/** googtrans cookie'sini tamamen siler (orijinal dile dön) */
export function clearGoogleTransCookie() {
  cookieDel('googtrans')
}

// ─── Tema yardımcıları ────────────────────────────────────────────────────

export function getSavedTheme(): 'dark' | 'light' | null {
  const c = cookieGet(THEME_COOKIE) as 'dark' | 'light' | null
  if (c === 'dark' || c === 'light') return c
  if (typeof localStorage !== 'undefined') {
    const ls = localStorage.getItem('theme')
    if (ls === 'dark' || ls === 'light') return ls as 'dark' | 'light'
  }
  return null
}

export function saveTheme(theme: 'dark' | 'light') {
  cookieSet(THEME_COOKIE, theme)
  if (typeof localStorage !== 'undefined') localStorage.setItem('theme', theme)
}
