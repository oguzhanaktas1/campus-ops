import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, BookOpen, GraduationCap, Wrench, ShieldCheck, ArrowRight } from 'lucide-react'

const roles = [
  {
    role: 'Students',
    icon: BookOpen,
    color: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800',
    iconColor: 'text-indigo-600',
    href: '/login?role=student',
    description: 'Submit internship requests, book appointments, reserve rooms, and track every request in real time.',
    items: ['Internship Approvals', 'Equipment Requests', 'Room Reservations', 'Appointment Booking'],
  },
  {
    role: 'Faculty',
    icon: GraduationCap,
    color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800',
    iconColor: 'text-emerald-600',
    href: '/login?role=faculty',
    description: 'Review student submissions, manage your schedule, approve workflows, and track departmental activity.',
    items: ['Student Request Reviews', 'Approval Workflows', 'Calendar Management', 'Performance Metrics'],
  },
  {
    role: 'Staff',
    icon: Wrench,
    color: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800',
    iconColor: 'text-amber-600',
    href: '/login?role=staff',
    description: 'Manage assigned tickets, track SLAs, handle room reservations, and keep operations running smoothly.',
    items: ['Ticket Queue Management', 'SLA Monitoring', 'Facility Reservations', 'Workflow Execution'],
  },
  {
    role: 'Admins',
    icon: ShieldCheck,
    color: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
    iconColor: 'text-red-600',
    href: '/login?role=admin',
    description: 'Full system visibility, user management, workflow configuration, reporting, and integration health.',
    items: ['User & Role Management', 'Workflow Builder', 'System Reports', 'Integration Monitoring'],
  },
]

export function RoleCards() {
  return (
    <section className="bg-muted/50 border-y border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground text-balance">A portal for every role</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto text-balance">
            Each role gets a tailor-made experience. No clutter. No confusion. Just the tools they need.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {roles.map((r) => {
            const Icon = r.icon
            return (
              <div key={r.role} className={`bg-card border rounded-lg p-5 shadow-sm flex flex-col gap-4 ${r.color}`}>
                <div>
                  <div className={`size-9 rounded-lg bg-white/60 dark:bg-white/10 flex items-center justify-center mb-3 ${r.iconColor}`}>
                    <Icon className="size-4" />
                  </div>
                  <h3 className="font-semibold text-foreground">{r.role}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{r.description}</p>
                </div>
                <ul className="space-y-1.5 flex-1">
                  {r.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-emerald-500 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={r.href}>
                  <Button variant="outline" size="sm" className="w-full gap-1.5">
                    View Portal <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}