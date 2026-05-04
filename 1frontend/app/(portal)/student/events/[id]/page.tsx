'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, AlertCircle, CalendarDays, MapPin, Users, User,
  CheckCircle2, Clock, ChevronLeft, PartyPopper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { formatStudentDate, translateStatus } from '@/lib/student-i18n-utils'

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED:          'bg-blue-50 text-blue-700 border-blue-200',
  REGISTRATION_OPEN:  'bg-green-50 text-green-700 border-green-200',
  REGISTRATION_CLOSED:'bg-orange-50 text-orange-700 border-orange-200',
  CONFIRMED:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED:          'bg-gray-50 text-gray-500 border-gray-200',
  RESCHEDULED:        'bg-yellow-50 text-yellow-700 border-yellow-200',
  CANCELLED:          'bg-red-50 text-red-700 border-red-200',
}

export default function StudentEventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
  const headers = { Authorization: `Bearer ${getToken()}` }
  const { locale, t } = useI18n()

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`${backend}/campus-events/${id}`, { headers })
      if (res.ok) {
        setEvent(await res.json())
      } else {
        toast.error(t('messages.eventNotFound'))
        router.push('/student/events')
      }
    } catch {
      toast.error(t('messages.loadEventFail'))
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { void fetchEvent() }, [fetchEvent])

  async function register() {
    setIsActionLoading(true)
    try {
      const res = await fetch(`${backend}/campus-events/${id}/register`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? t('messages.failed'))
      }
      toast.success(t('messages.registerSuccess'))
      void fetchEvent()
    } catch (err: any) {
      toast.error(err.message ?? t('messages.registerFail'))
    } finally {
      setIsActionLoading(false)
    }
  }

  async function cancelRegistration() {
    if (!confirm(t('messages.cancelRegistrationConfirm'))) return
    setIsActionLoading(true)
    try {
      const res = await fetch(`${backend}/campus-events/${id}/register`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error()
      toast.success(t('messages.registrationCancelled'))
      void fetchEvent()
    } catch {
      toast.error(t('messages.cancelRegistrationFail'))
    } finally {
      setIsActionLoading(false)
    }
  }

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  if (!event) return null

  const isRegistered = event.userRegistration?.status === 'REGISTERED'
  const canRegister = event.status === 'REGISTRATION_OPEN'
  const now = new Date()
  const regOpen = event.registrationStartAt ? now >= new Date(event.registrationStartAt) : true
  const regClosed = event.registrationEndAt ? now > new Date(event.registrationEndAt) : false

  return (
    <div className="p-6 max-w-2xl mx-auto pb-20 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/student/events" className="hover:underline flex items-center gap-1">
          <ChevronLeft className="size-3" /> {t('pages.eventsTitle')}
        </Link>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <PartyPopper className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{event.title}</h1>
              <p className="text-sm text-muted-foreground">{event.eventType}</p>
            </div>
          </div>
          <span className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0',
            STATUS_BADGE[event.status] ?? STATUS_BADGE.PUBLISHED,
          )}>
            {translateStatus(event.status, t)}
          </span>
        </div>

        {event.description && (
          <p className="text-sm text-muted-foreground">{event.description}</p>
        )}

        {/* Details grid */}
        <div className="grid sm:grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
          <div className="flex items-start gap-2">
            <CalendarDays className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{t('forms.dateTime')}</p>
              <p className="text-muted-foreground text-xs">
                {new Date(event.startAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}
              </p>
              <p className="text-muted-foreground text-xs">
                {locale === 'tr' ? 'bitis' : 'to'} {new Date(event.endAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US')}
              </p>
            </div>
          </div>
          {event.locationText && (
            <div className="flex items-start gap-2">
              <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{t('forms.preferredLocation')}</p>
                <p className="text-muted-foreground text-xs">{event.locationText}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Users className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{t('forms.attendance')}</p>
              <p className="text-muted-foreground text-xs">
                {event.registrationCount} {locale === 'tr' ? 'kayitli' : 'registered'}
                {event.minimumAttendance && ` · min ${event.minimumAttendance}`}
                {event.targetAttendance && ` · target ${event.targetAttendance}`}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{t('forms.organizer')}</p>
              <p className="text-muted-foreground text-xs">
                {event.organizerName}
                {event.organizerTitle && ` · ${event.organizerTitle}`}
              </p>
            </div>
          </div>
          {(event.registrationStartAt || event.registrationEndAt) && (
            <div className="flex items-start gap-2 sm:col-span-2">
              <Clock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{t('forms.registrationPeriod')}</p>
                <p className="text-muted-foreground text-xs">
                  {event.registrationStartAt ? formatStudentDate(event.registrationStartAt, locale) : '?'}
                  {' -> '}
                  {event.registrationEndAt ? formatStudentDate(event.registrationEndAt, locale) : '?'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Registration card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold">{t('forms.registration')}</p>

        {isRegistered ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            <CheckCircle2 className="size-4 shrink-0" />
            {t('forms.registeredMessage')}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {canRegister && regOpen && !regClosed
              ? t('forms.registrationOpenMessage')
              : t('forms.registrationClosedMessage')}
          </p>
        )}

        <div className="flex gap-2">
          {isRegistered ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={cancelRegistration}
              disabled={isActionLoading}
              className="gap-2"
            >
              {isActionLoading && <Loader2 className="size-4 animate-spin" />}
              {t('forms.cancelRegistration')}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={register}
              disabled={isActionLoading || !canRegister || !regOpen || regClosed}
              className="gap-2"
            >
              {isActionLoading && <Loader2 className="size-4 animate-spin" />}
              {t('forms.register')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
