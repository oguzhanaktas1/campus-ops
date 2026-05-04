'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, BookOpen, GraduationCap, Wrench, ShieldCheck, ArrowRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

const roles = [
  {
    roleKey: 'roles.students.title',
    icon: BookOpen,
    accent: 'from-indigo-500 to-blue-500',
    border: 'border-indigo-200 dark:border-indigo-800',
    bg: 'bg-indigo-50/60 dark:bg-indigo-950/20',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    href: '/login?role=student',
    descriptionKey: 'roles.students.description',
    itemKeys: ['roles.students.item1', 'roles.students.item2', 'roles.students.item3', 'roles.students.item4', 'roles.students.item5'],
  },
  {
    roleKey: 'roles.faculty.title',
    icon: GraduationCap,
    accent: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    href: '/login?role=faculty',
    descriptionKey: 'roles.faculty.description',
    itemKeys: ['roles.faculty.item1', 'roles.faculty.item2', 'roles.faculty.item3', 'roles.faculty.item4', 'roles.faculty.item5'],
  },
  {
    roleKey: 'roles.staff.title',
    icon: Wrench,
    accent: 'from-amber-500 to-orange-500',
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50/60 dark:bg-amber-950/20',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    href: '/login?role=staff',
    descriptionKey: 'roles.staff.description',
    itemKeys: ['roles.staff.item1', 'roles.staff.item2', 'roles.staff.item3', 'roles.staff.item4', 'roles.staff.item5'],
  },
  {
    roleKey: 'roles.admins.title',
    icon: ShieldCheck,
    accent: 'from-red-500 to-rose-500',
    border: 'border-red-200 dark:border-red-800',
    bg: 'bg-red-50/60 dark:bg-red-950/20',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    href: '/login?role=admin',
    descriptionKey: 'roles.admins.description',
    itemKeys: ['roles.admins.item1', 'roles.admins.item2', 'roles.admins.item3', 'roles.admins.item4', 'roles.admins.item5'],
  },
]

export function RoleCards() {
  const { t } = useI18n()

  return (
    <section
      id="portals"
      className="bg-muted/30 border-y border-border py-20 sm:py-24"
      aria-labelledby="portals-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">{t('roles.eyebrow')}</p>
          <h2
            id="portals-heading"
            className="text-3xl sm:text-4xl font-extrabold text-foreground text-balance"
          >
            {t('roles.title')}
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-balance">
            {t('roles.subtitle')}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {roles.map((r) => {
            const Icon = r.icon
            const role = t(r.roleKey)
            return (
              <article
                key={r.roleKey}
                className={`relative flex flex-col gap-4 rounded-xl border ${r.border} ${r.bg} p-5 shadow-sm hover:shadow-md transition-shadow`}
              >
                {/* Top gradient line */}
                <div className={`absolute top-0 inset-x-0 h-0.5 rounded-t-xl bg-gradient-to-r ${r.accent} opacity-70`} aria-hidden="true" />

                <div>
                  <div className={`size-10 rounded-xl ${r.iconBg} flex items-center justify-center mb-4`}>
                    <Icon className={`size-5 ${r.iconColor}`} />
                  </div>
                  <h3 className="font-bold text-foreground text-base">{role}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{t(r.descriptionKey)}</p>
                </div>

                <ul className="space-y-1.5 flex-1" aria-label={t('roles.featuresAria', { role })}>
                  {r.itemKeys.map((itemKey) => (
                    <li key={itemKey} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-emerald-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      {t(itemKey)}
                    </li>
                  ))}
                </ul>

                <Link href={r.href} aria-label={t('roles.accessAria', { role })}>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 mt-1">
                    {t('roles.viewPortal')} <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
