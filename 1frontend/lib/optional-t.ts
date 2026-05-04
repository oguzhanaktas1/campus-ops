'use client'

import { useOptionalI18n } from '@/lib/i18n'

export function useOptionalT() {
  const i18n = useOptionalI18n()

  return (key: string, fallback: string, params?: Record<string, string | number>) => {
    if (!i18n) return fallback
    const value = i18n.t(key, params)
    return value === key ? fallback : value
  }
}
