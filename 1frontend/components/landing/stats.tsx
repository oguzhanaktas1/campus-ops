'use client'

import { Users, GraduationCap, Clock, TrendingUp } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export function Stats() {
  const { t } = useI18n()
  const stats = [
    {
      icon: Users,
      value: '12,000+',
      label: t('stats.activeUsers'),
      description: t('stats.activeUsersDesc'),
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      icon: GraduationCap,
      value: '840',
      label: t('stats.facultyMembers'),
      description: t('stats.facultyMembersDesc'),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      icon: TrendingUp,
      value: '99.4%',
      label: t('stats.uptime'),
      description: t('stats.uptimeDesc'),
      color: 'text-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      icon: Clock,
      value: '18 hrs',
      label: t('stats.avgResolution'),
      description: t('stats.avgResolutionDesc'),
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
  ]

  return (
    <section className="border-y border-border bg-muted/30" aria-label={t('stats.aria')}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="text-center space-y-2">
              <div className={`size-10 ${s.bg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                <Icon className={`size-5 ${s.color}`} />
              </div>
              <p className="text-3xl font-extrabold text-foreground tracking-tight">{s.value}</p>
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed hidden sm:block">{s.description}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
