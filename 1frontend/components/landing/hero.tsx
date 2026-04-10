import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

const trustPoints = [
  'No credit card required',
  'Free 30-day trial',
  'Setup in under 10 minutes',
]

const DashboardPreview = () => (
  <div className="relative w-full max-w-4xl mx-auto mt-14">
    {/* Glow effect */}
    <div className="absolute inset-x-0 -top-10 h-40 bg-primary/20 blur-3xl rounded-full opacity-60 pointer-events-none" aria-hidden="true" />

    {/* Browser chrome */}
    <div className="relative rounded-xl border border-border bg-card shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
      {/* Browser top bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full bg-red-400" />
          <div className="size-3 rounded-full bg-amber-400" />
          <div className="size-3 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 mx-4">
          <div className="h-6 bg-background border border-border rounded-md flex items-center px-3">
            <span className="text-[11px] text-muted-foreground font-mono">www.campusops.com.tr/student/dashboard</span>
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="flex h-[340px] sm:h-[400px]">
        {/* Sidebar */}
        <div className="hidden sm:flex w-44 border-r border-border bg-muted/30 flex-col p-3 gap-1">
          <div className="h-7 bg-primary/10 rounded-md mb-2 flex items-center gap-2 px-2">
            <div className="size-3 rounded bg-primary/40" />
            <div className="h-2 w-16 bg-primary/40 rounded" />
          </div>
          {['Requests', 'Documents', 'Appointments', 'Equipment', 'Events', 'Settings'].map((item) => (
            <div key={item} className="h-7 rounded-md hover:bg-muted flex items-center gap-2 px-2">
              <div className="size-2.5 rounded bg-muted-foreground/25" />
              <div className="h-2 bg-muted-foreground/25 rounded" style={{ width: `${item.length * 5}px` }} />
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 sm:p-5 bg-background overflow-hidden">
          {/* Greeting + stats */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="h-4 w-40 bg-foreground/80 rounded mb-1.5" />
              <div className="h-2.5 w-28 bg-muted-foreground/30 rounded" />
            </div>
            <div className="size-8 rounded-full bg-primary/20 border border-primary/30" />
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { color: 'bg-blue-500', label: 'Pending', val: '3' },
              { color: 'bg-emerald-500', label: 'Approved', val: '12' },
              { color: 'bg-amber-500', label: 'In Review', val: '2' },
              { color: 'bg-purple-500', label: 'Completed', val: '47' },
            ].map((m) => (
              <div key={m.label} className="bg-card border border-border rounded-lg p-3">
                <div className={`size-5 rounded mb-2 ${m.color} opacity-80`} />
                <div className="text-lg font-bold text-foreground leading-none">{m.val}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Request list */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="h-2.5 w-24 bg-foreground/60 rounded" />
              <div className="h-5 w-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center">
                <div className="h-1.5 w-10 bg-primary/40 rounded" />
              </div>
            </div>
            {[
              { color: 'bg-blue-400', w: 'w-32', badge: 'bg-amber-100 border-amber-200' },
              { color: 'bg-emerald-400', w: 'w-40', badge: 'bg-emerald-100 border-emerald-200' },
              { color: 'bg-purple-400', w: 'w-28', badge: 'bg-blue-100 border-blue-200' },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                <div className={`size-2.5 rounded-full ${row.color} shrink-0`} />
                <div className={`h-2 ${row.w} bg-foreground/30 rounded`} />
                <div className="h-2 w-20 bg-muted-foreground/20 rounded hidden sm:block" />
                <div className="ml-auto">
                  <div className={`h-4 w-16 border rounded-full ${row.badge}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
)

export function Hero() {
  return (
    <section
      className="relative overflow-hidden pt-16 pb-8 sm:pt-20 sm:pb-12"
      aria-labelledby="hero-heading"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute top-40 right-0 w-72 h-72 bg-indigo-500/6 rounded-full blur-3xl" />
        <div className="absolute top-20 left-0 w-64 h-64 bg-emerald-500/6 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
          <div className="size-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold text-primary tracking-wide uppercase">
            Purpose-built for higher education
          </span>
        </div>

        {/* Headline */}
        <h1
          id="hero-heading"
          className="text-4xl sm:text-5xl lg:text-[3.75rem] font-extrabold text-foreground leading-[1.1] tracking-tight text-balance mb-6"
        >
          One platform for every{' '}
          <span className="relative">
            <span className="bg-gradient-to-r from-primary via-indigo-500 to-primary bg-clip-text text-transparent">
              campus operation
            </span>
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance mb-10 leading-relaxed">
          CampusOps connects students, faculty, staff, and admins in a unified workflow platform.
          Eliminate paperwork, automate approvals, and keep your institution running at full speed.
        </p>

        {/* CTA buttons */}
        <div className="flex items-center justify-center gap-3 flex-wrap mb-8">
          <Link href="/sign-up">
            <Button size="lg" className="gap-2 shadow-md shadow-primary/25 h-12 px-6 text-base">
              Start free trial <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="h-12 px-6 text-base">
              View demo portals
            </Button>
          </Link>
        </div>

        {/* Trust points */}
        <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
          {trustPoints.map((point) => (
            <div key={point} className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              {point}
            </div>
          ))}
        </div>

        {/* Dashboard preview */}
        <DashboardPreview />
      </div>
    </section>
  )
}
