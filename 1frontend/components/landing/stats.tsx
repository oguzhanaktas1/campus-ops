import { Users, GraduationCap, Clock, TrendingUp } from 'lucide-react'

const stats = [
  {
    icon: Users,
    value: '12,000+',
    label: 'Active Users',
    description: 'Students, faculty & staff on one platform',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    icon: GraduationCap,
    value: '840',
    label: 'Faculty Members',
    description: 'Approving requests across departments',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    icon: TrendingUp,
    value: '99.4%',
    label: 'Uptime SLA',
    description: 'Enterprise-grade reliability guaranteed',
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
  },
  {
    icon: Clock,
    value: '18 hrs',
    label: 'Avg. Resolution',
    description: 'Down from 5+ days with manual processing',
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
  },
]

export function Stats() {
  return (
    <section className="border-y border-border bg-muted/30" aria-label="Platform statistics">
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
