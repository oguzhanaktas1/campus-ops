'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { Briefcase, PlusCircle, Clock, Building2, Loader2, Calendar, AlertCircle } from 'lucide-react'
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.internshipsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.internshipsSubtitle')}</p>
        </div>
        <Link href="/student/internships/new" className="shrink-0">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            {t('pages.newApplication')}
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : internships.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('pages.noInternships')}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">{t('pages.noInternshipsDesc')}</p>
            <Link href="/student/internships/new">
              <Button size="sm" variant="outline">{t('pages.applyForInternship')}</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {internships.map((item) => (
              <Link
                key={item.id}
                href={`/student/requests/${item.id}`}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {item.companyName && (
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" />
                        {item.companyName}
                      </span>
                    )}
                    {item.startDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatStudentDate(item.startDate, locale)} → {formatStudentDate(item.endDate, locale)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatStudentDate(item.createdAt, locale)}
                    </span>
                    {item.advisorName && (
                      <span>{locale === 'tr' ? 'Danışman' : 'Advisor'}: {item.advisorName}</span>
                    )}
                  </div>
                </div>
                <StatusBadge status={item.displayStatus ?? item.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
