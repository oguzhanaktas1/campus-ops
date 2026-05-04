'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { Briefcase, PlusCircle, Clock, Building2, Loader2, Calendar } from 'lucide-react'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { formatStudentDate } from '@/lib/student-i18n-utils'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export default function StudentInternshipsPage() {
  const [internships, setInternships] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { locale, t } = useI18n()

  useEffect(() => {
    fetch(`${BACKEND}/student/internships`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then(setInternships)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.internshipsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.internshipsSubtitle')}</p>
        </div>
        <Link href="/student/internships/new">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            {t('pages.newApplication')}
          </Button>
        </Link>
      </div>

      {internships.length === 0 ? (
        <div className="flex flex-col items-center py-16 bg-card border border-border rounded-lg text-center">
          <Briefcase className="size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">{t('pages.noInternships')}</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">{t('pages.noInternshipsDesc')}</p>
          <Link href="/student/internships/new">
            <Button size="sm">{t('pages.applyForInternship')}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {internships.map((item) => (
            <Link key={item.id} href={`/student/requests/${item.id}`}>
              <div className="bg-card border border-border rounded-lg p-4 flex items-start justify-between gap-4 hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="size-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="size-4 text-amber-700 dark:text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {item.companyName && (
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3" />
                          {item.companyName}
                        </span>
                      )}
                      {item.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formatStudentDate(item.startDate, locale)} {'->'} {formatStudentDate(item.endDate, locale)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatStudentDate(item.createdAt, locale)}
                      </span>
                    </div>
                    {item.advisorName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{locale === 'tr' ? 'Danisman' : 'Advisor'}: {item.advisorName}</p>
                    )}
                  </div>
                </div>
                <StatusBadge status={item.displayStatus ?? item.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
