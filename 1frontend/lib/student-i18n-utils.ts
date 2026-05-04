import type { Locale } from '@/lib/i18n'

export function formatStudentDate(value: string | Date | null | undefined, locale: Locale) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatStudentTime(value: string | Date | null | undefined, locale: Locale) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function translateStatus(
  status: string | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (!status) return ''
  const key = `status.${status.toUpperCase()}`
  const label = t(key)
  return label === key ? status.replace(/_/g, ' ') : label
}

export function formatStudentTimeAgo(
  value: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000
  if (diff < 60) return t('time.justNow')
  if (diff < 3600) return t('time.minutesAgo', { count: Math.floor(diff / 60) })
  if (diff < 86400) return t('time.hoursAgo', { count: Math.floor(diff / 3600) })
  return t('time.daysAgo', { count: Math.floor(diff / 86400) })
}
