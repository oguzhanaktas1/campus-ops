import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, BookOpen, GraduationCap, Wrench, ShieldCheck, ArrowRight } from 'lucide-react'

const roles = [
  {
    role: 'Students',
    icon: BookOpen,
    accent: 'from-indigo-500 to-blue-500',
    border: 'border-indigo-200 dark:border-indigo-800',
    bg: 'bg-indigo-50/60 dark:bg-indigo-950/20',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    href: '/login?role=student',
    description: 'Submit internship requests, book appointments, reserve rooms, and track every request in real time.',
    items: [
      'Internship applications',
      'Equipment & lab requests',
      'Room reservations',
      'Appointment booking',
      'Document requests',
    ],
  },
  {
    role: 'Faculty',
    icon: GraduationCap,
    accent: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    href: '/login?role=faculty',
    description: 'Review student submissions, manage your schedule, approve workflows, and track departmental activity.',
    items: [
      'Student request reviews',
      'Approval workflows',
      'Calendar management',
      'Procurement oversight',
      'Performance metrics',
    ],
  },
  {
    role: 'Staff',
    icon: Wrench,
    accent: 'from-amber-500 to-orange-500',
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50/60 dark:bg-amber-950/20',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    href: '/login?role=staff',
    description: 'Manage assigned tickets, track SLAs, handle room reservations, and keep operations running smoothly.',
    items: [
      'IT ticket queue',
      'SLA monitoring',
      'Facility reservations',
      'Inventory management',
      'Workflow execution',
    ],
  },
  {
    role: 'Admins',
    icon: ShieldCheck,
    accent: 'from-red-500 to-rose-500',
    border: 'border-red-200 dark:border-red-800',
    bg: 'bg-red-50/60 dark:bg-red-950/20',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    href: '/login?role=admin',
    description: 'Full system visibility, user management, workflow configuration, reporting, and integration health.',
    items: [
      'User & role management',
      'Workflow builder',
      'System-wide reports',
      'Audit logs',
      'Integration monitoring',
    ],
  },
]

export function RoleCards() {
  return (
    <section
      id="portals"
      className="bg-muted/30 border-y border-border py-20 sm:py-24"
      aria-labelledby="portals-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Role-based portals</p>
          <h2
            id="portals-heading"
            className="text-3xl sm:text-4xl font-extrabold text-foreground text-balance"
          >
            A portal built for every role
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-balance">
            Each user gets a tailor-made interface. No clutter. No confusion. Just the tools they need,
            exactly when they need them.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {roles.map((r) => {
            const Icon = r.icon
            return (
              <article
                key={r.role}
                className={`relative flex flex-col gap-4 rounded-xl border ${r.border} ${r.bg} p-5 shadow-sm hover:shadow-md transition-shadow`}
              >
                {/* Top gradient line */}
                <div className={`absolute top-0 inset-x-0 h-0.5 rounded-t-xl bg-gradient-to-r ${r.accent} opacity-70`} aria-hidden="true" />

                <div>
                  <div className={`size-10 rounded-xl ${r.iconBg} flex items-center justify-center mb-4`}>
                    <Icon className={`size-5 ${r.iconColor}`} />
                  </div>
                  <h3 className="font-bold text-foreground text-base">{r.role}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{r.description}</p>
                </div>

                <ul className="space-y-1.5 flex-1" aria-label={`${r.role} portal features`}>
                  {r.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-emerald-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link href={r.href} aria-label={`Access ${r.role} portal`}>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 mt-1">
                    View portal <ArrowRight className="size-3.5" />
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
