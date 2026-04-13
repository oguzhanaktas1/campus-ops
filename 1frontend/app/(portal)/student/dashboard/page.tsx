'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MetricCard } from '@/components/metric-card'
import { StatusBadge } from '@/components/status-badge'
import {
  FileText,
  Clock,
  CheckCircle2,
  PlusCircle,
  Calendar,
  BookMarked,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { fetchProfile, getStoredUser, getToken } from '@/lib/auth'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function StudentDashboard() {
  const [user, setUser] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      const storedUser = getStoredUser()
      const token = getToken()
      if (!storedUser || !token) {
        setIsLoading(false)
        return
      }

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const headers = { Authorization: `Bearer ${token}` }

      try {
        const [profile, reqRes, aptRes, resRes, notifRes] = await Promise.all([
          fetchProfile(),
          fetch(`${backendUrl}/student/requests`, { headers }),
          fetch(`${backendUrl}/student/appointments`, { headers }),
          fetch(`${backendUrl}/student/reservations`, { headers }),
          fetch(`${backendUrl}/student/notifications`, { headers }),
        ])

        setUser(profile)
        if (reqRes.ok) setRequests(await reqRes.json())
        if (aptRes.ok) setAppointments(await aptRes.json())
        if (resRes.ok) setReservations(await resRes.json())
        if (notifRes.ok) setNotifications(await notifRes.json())
      } catch (error) {
        console.error('Dashboard data fetch failed:', error)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchDashboardData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  const open = requests.filter(
    (r) =>
      ![
        'COMPLETED',
        'APPROVED',
        'REJECTED',
        'CANCELLED',
        'CLOSED',
        'EXPIRED',
        'RESOLVED',
      ].includes(r.status),
  )
  const pendingApprovals = requests.filter((r) =>
    ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'].includes(r.status),
  )
  const completed = requests.filter((r) =>
    ['COMPLETED', 'APPROVED', 'RESOLVED'].includes(r.status),
  )

  const upcomingApts = appointments.filter((a) =>
    ['requested', 'confirmed'].includes(a.status?.toLowerCase()),
  )
  const confirmedRes = reservations.filter((r) =>
    ['pending', 'approved', 'active'].includes(r.status?.toLowerCase()),
  )

  const unread = notifications
    .filter((n) => !n.isRead)
    .slice(0, 3)
    .map((n) => ({
      ...n,
      uiType: n.type === 'SYSTEM' ? 'warning' : 'info',
    }))

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'Student'

  const quickActions = [
    {
      label: 'Internship Application',
      href: '/student/internships/new',
      icon: PlusCircle,
      color: 'bg-primary/10 text-primary',
    },
    {
      label: 'Book Appointment',
      href: '/student/requests?type=internship_approval',
      icon: Calendar,
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
    },
    {
      label: 'Reserve Room',
      href: '/student/requests?type=room_reservation',
      icon: BookMarked,
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
    },
    {
      label: 'My Files',
      href: '/student/files',
      icon: FileText,
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Good morning, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here's a summary of your campus activity.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Open Requests"
          value={open.length}
          description="Awaiting action"
          icon={<FileText className="size-4" />}
          trend={open.length > 0 ? 12 : 0}
          trendLabel="vs last month"
        />
        <MetricCard
          title="Pending Approvals"
          value={pendingApprovals.length}
          description="Under review"
          icon={<Clock className="size-4" />}
        />
        <MetricCard
          title="Completed"
          value={completed.length}
          description="This semester"
          icon={<CheckCircle2 className="size-4" />}
          trend={completed.length > 0 ? 8 : 0}
          trendLabel="vs last month"
        />
        <MetricCard
          title="Upcoming"
          value={upcomingApts.length + confirmedRes.length}
          description="Appointments & rooms"
          icon={<Calendar className="size-4" />}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link key={action.href} href={action.href}>
                <div className="bg-card border border-border rounded-lg p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow cursor-pointer text-center">
                  <div
                    className={`size-10 rounded-lg flex items-center justify-center ${action.color}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {action.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              My Open Requests
            </h2>
            <Link href="/student/requests">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                View all <ArrowRight className="size-3" />
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {open.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No open requests.
              </p>
            ) : (
              open.slice(0, 5).map((req) => (
                <Link key={req.id} href={`/student/requests/${req.id}`}>
                  <div className="px-5 py-3.5 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {req.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {req.type?.replace(/_/g, ' ')} · {formatDate(req.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                Upcoming Appointments
              </h2>
              <Link href="/student/appointments">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto py-0.5 gap-1"
                >
                  View <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {upcomingApts.slice(0, 2).map((apt) => (
                <div key={apt.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">
                    {apt.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {apt.with}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(apt.date)} · {apt.time} · {apt.location}
                  </p>
                </div>
              ))}
              {upcomingApts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No upcoming appointments.
                </p>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                Notifications
              </h2>
              <Link href="/student/notifications">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto py-0.5 gap-1"
                >
                  View <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {unread.map((n) => (
                <div key={n.id} className="px-4 py-3 flex gap-2.5 items-start">
                  <div
                    className={`size-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                      n.uiType === 'success'
                        ? 'bg-emerald-500'
                        : n.uiType === 'warning'
                          ? 'bg-amber-500'
                          : n.uiType === 'error'
                            ? 'bg-red-500'
                            : 'bg-blue-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                  </div>
                </div>
              ))}
              {unread.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  All caught up!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
