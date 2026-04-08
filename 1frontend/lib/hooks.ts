'use client'

import { useState, useEffect } from 'react'
import {
  MOCK_USERS,
  MOCK_REQUESTS,
  MOCK_NOTIFICATIONS,
  MOCK_APPOINTMENTS,
  MOCK_RESERVATIONS,
  ADMIN_METRICS,
  ADMIN_USERS,
  AUDIT_LOGS,
  type User,
  type Request,
  type Notification,
  type Appointment,
  type Reservation,
  type Role,
} from './mock-data'

// ===== useCurrentUser (real — delegates to hooks/use-current-user.ts) =====
export { useCurrentUser } from '@/features/hooks/use-current-user'

// ===== useStudentRequests =====
export function useStudentRequests() {
  const requests = MOCK_REQUESTS.filter((r) => r.submittedBy === 'u1')
  const open = requests.filter((r) => ['pending', 'under_review', 'in_progress'].includes(r.status))
  const pendingApprovals = requests.filter((r) => r.status === 'under_review')
  const completed = requests.filter((r) => ['approved', 'completed'].includes(r.status))
  return { requests, open, pendingApprovals, completed, all: requests }
}

// ===== useFacultyApprovals =====
export function useFacultyApprovals() {
  const pending = MOCK_REQUESTS.filter((r) =>
    ['pending', 'under_review'].includes(r.status) && r.assignedTo === 'u2'
  )
  const all = MOCK_REQUESTS.filter((r) => r.assignedTo === 'u2')
  const internships = MOCK_REQUESTS.filter((r) => r.type === 'internship')
  const appointments = MOCK_APPOINTMENTS.filter((a) => a.with === 'Dr. Sarah Mitchell' || a.withRole === 'student')
  const metrics = {
    pendingCount: pending.length,
    approvedToday: 3,
    rejectedToday: 1,
    avgReviewHours: 6.2,
  }
  return { pending, all, internships, appointments, metrics }
}

// ===== useStaffQueue =====
export function useStaffQueue() {
  const assigned = MOCK_REQUESTS.filter((r) => r.assignedTo === 'u3')
  const all = MOCK_REQUESTS
  const overdue = MOCK_REQUESTS.filter((r) => {
    if (!r.dueDate) return false
    return new Date(r.dueDate) < new Date() && !['completed', 'approved'].includes(r.status)
  })
  const urgent = MOCK_REQUESTS.filter((r) => r.priority === 'urgent')
  const metrics = {
    assignedCount: assigned.length,
    overdueCount: overdue.length,
    completedToday: 5,
    slaBreaches: 2,
    avgResponseHours: 3.8,
  }
  return { assigned, all, overdue, urgent, metrics }
}

// ===== useAdminMetrics =====
export function useAdminMetrics() {
  return {
    metrics: ADMIN_METRICS,
    users: ADMIN_USERS,
    logs: AUDIT_LOGS,
    integrations: [
      { id: 'int-1', name: 'Email (SMTP)', status: 'degraded', lastSync: '2 min ago', type: 'email' },
      { id: 'int-2', name: 'LDAP Directory', status: 'healthy', lastSync: '5 min ago', type: 'auth' },
      { id: 'int-3', name: 'Calendar API', status: 'healthy', lastSync: '1 min ago', type: 'calendar' },
      { id: 'int-4', name: 'Storage Service', status: 'healthy', lastSync: '3 min ago', type: 'storage' },
      { id: 'int-5', name: 'SMS Gateway', status: 'offline', lastSync: '45 min ago', type: 'sms' },
    ],
  }
}

// ===== useNotifications =====
export function useNotifications(role?: Role) {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const unreadCount = notifications.filter((n) => !n.read).length

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return { notifications, unreadCount, markRead, markAllRead }
}

// ===== useAppointments =====
export function useAppointments(role?: Role) {
  const appointments =
    role === 'faculty'
      ? MOCK_APPOINTMENTS.filter((a) => a.withRole === 'student' || a.with === 'Department Team')
      : role === 'staff'
        ? MOCK_APPOINTMENTS.filter((a) => a.with === 'New Faculty Members')
        : MOCK_APPOINTMENTS.filter((a) => a.withRole === 'faculty')

  const upcoming = appointments.filter((a) => a.status === 'scheduled' || a.status === 'pending')
  const today = appointments.filter((a) => a.date === '2024-11-18')

  return { appointments, upcoming, today }
}

// ===== useReservations =====
export function useReservations(role?: Role) {
  const reservations =
    role === 'student'
      ? MOCK_RESERVATIONS.filter((r) => r.reservedBy === 'Alex Johnson')
      : MOCK_RESERVATIONS

  const confirmed = reservations.filter((r) => r.status === 'confirmed')
  const pending = reservations.filter((r) => r.status === 'pending')

  return { reservations, confirmed, pending }
}

// ===== useRequest (single) =====
export function useRequest(id: string) {
  const request = MOCK_REQUESTS.find((r) => r.id === id)
  return { request }
}
