const THEME_COOKIE = 'cf_theme'

function cookieGet(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function cookieSet(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value};expires=${expires};path=/;SameSite=Lax`
}

export function getSavedTheme(): 'dark' | 'light' | null {
  const cookieTheme = cookieGet(THEME_COOKIE) as 'dark' | 'light' | null
  if (cookieTheme === 'dark' || cookieTheme === 'light') return cookieTheme

  if (typeof localStorage !== 'undefined') {
    const localTheme = localStorage.getItem('theme')
    if (localTheme === 'dark' || localTheme === 'light') return localTheme
  }

  return null
}

export function saveTheme(theme: 'dark' | 'light') {
  cookieSet(THEME_COOKIE, theme)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('theme', theme)
  }
}
