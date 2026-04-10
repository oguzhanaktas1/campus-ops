import type { Metadata } from 'next'
import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { Stats } from '@/components/landing/stats'
import { RoleCards } from '@/components/landing/role-cards'
import { CTA } from '@/components/landing/cta'
import { Footer } from '@/components/landing/footer'
import {
  FileText, Calendar, BarChart3, ShieldCheck, Zap, Users,
  ClipboardList, CheckSquare, Bell,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'CampusOps – Smart Campus Operations Platform',
  description:
    'CampusOps is the all-in-one operations platform for universities. Manage student requests, faculty approvals, IT tickets, room reservations, and procurement workflows — all in one place.',
  alternates: {
    canonical: '/',
  },
}

const features = [
  {
    icon: FileText,
    title: 'Unified Request Management',
    description:
      'Every campus request — internships, documents, equipment, access — flows through a single, trackable system.',
  },
  {
    icon: Calendar,
    title: 'Appointment & Room Scheduling',
    description:
      'Book meetings with faculty, reserve campus spaces, and manage availability with conflict detection built in.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description:
      'Track request volumes, approval rates, resolution times, and SLA compliance across every department.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based Access Control',
    description:
      'Four distinct portals with fine-grained permissions. Users see exactly what they need — nothing more.',
  },
  {
    icon: Zap,
    title: 'Automated Workflows',
    description:
      'Define multi-step approval chains with conditions, SLA policies, escalations, and automatic notifications.',
  },
  {
    icon: Users,
    title: 'Campus Directory & Org Structure',
    description:
      'Unified user management across faculties, departments, and units. One source of truth for your institution.',
  },
]

const howItWorks = [
  {
    step: '01',
    icon: ClipboardList,
    title: 'Submit a request',
    description:
      'Students, faculty, or staff submit a request through their dedicated portal — from internship applications to room reservations.',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
  },
  {
    step: '02',
    icon: CheckSquare,
    title: 'Automated routing & review',
    description:
      'The workflow engine routes the request to the right person at the right time. No manual handoffs. No lost emails.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  {
    step: '03',
    icon: Bell,
    title: 'Decision & notification',
    description:
      'Approvers act — approve, reject, or request revision. Every stakeholder gets notified instantly. Full audit trail kept.',
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
  },
]

const testimonials = [
  {
    quote:
      'We reduced our internship approval cycle from 3 weeks to 2 days. The workflow automation alone was worth the switch.',
    name: 'Dr. Ayşe Korkmaz',
    role: 'Faculty Dean, Engineering Department',
    initials: 'AK',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    quote:
      'Students finally know where their requests stand. No more "did you receive my email?" conversations.',
    name: 'Mert Yıldız',
    role: 'Student Affairs Director',
    initials: 'MY',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    quote:
      'Our IT team resolved 40% more tickets per week after switching — the triage and SLA tracking made the difference.',
    name: 'Elif Şahin',
    role: 'Head of IT Operations',
    initials: 'EŞ',
    color: 'bg-purple-100 text-purple-700',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        {/* 1 — Hero */}
        <Hero />

        {/* 2 — Stats */}
        <Stats />

        {/* 3 — Features */}
        <section
          id="features"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24"
          aria-labelledby="features-heading"
        >
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Platform features</p>
            <h2
              id="features-heading"
              className="text-3xl sm:text-4xl font-extrabold text-foreground text-balance"
            >
              Everything your campus needs
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-balance">
              From request submission to final resolution — every campus operation covered in one coherent system.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <article
                  key={f.title}
                  className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 group"
                >
                  <div className="size-11 rounded-xl bg-primary/8 group-hover:bg-primary/12 flex items-center justify-center text-primary mb-4 transition-colors">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        {/* 4 — How it works */}
        <section
          id="how-it-works"
          className="border-y border-border bg-muted/30 py-20 sm:py-24"
          aria-labelledby="how-heading"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">How it works</p>
              <h2
                id="how-heading"
                className="text-3xl sm:text-4xl font-extrabold text-foreground text-balance"
              >
                From request to resolution in 3 steps
              </h2>
              <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-balance">
                No more spreadsheets, shared inboxes, or lost emails. CampusOps brings structure
                and visibility to every campus process.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 relative">
              {/* Connector line (desktop) */}
              <div
                className="hidden md:block absolute top-[52px] left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-0.5 bg-gradient-to-r from-blue-200 via-emerald-200 to-purple-200 dark:from-blue-900 dark:via-emerald-900 dark:to-purple-900"
                aria-hidden="true"
              />

              {howItWorks.map((step) => {
                const Icon = step.icon
                return (
                  <div key={step.step} className="relative flex flex-col items-center text-center">
                    <div
                      className={`relative z-10 size-[72px] rounded-2xl border-2 ${step.border} ${step.bg} flex items-center justify-center mb-5 shadow-sm`}
                    >
                      <Icon className={`size-7 ${step.color}`} aria-hidden="true" />
                      <span
                        className={`absolute -top-2 -right-2 text-[10px] font-black ${step.color} bg-background border border-border rounded-full size-5 flex items-center justify-center shadow-sm`}
                        aria-label={`Step ${step.step}`}
                      >
                        {step.step}
                      </span>
                    </div>
                    <h3 className="font-bold text-foreground text-base mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                      {step.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* 5 — Role Cards */}
        <RoleCards />

        {/* 6 — Testimonials */}
        <section
          className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24"
          aria-labelledby="testimonials-heading"
        >
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">
              Social proof
            </p>
            <h2
              id="testimonials-heading"
              className="text-3xl sm:text-4xl font-extrabold text-foreground text-balance"
            >
              Trusted by campus teams
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col gap-4"
              >
                <blockquote>
                  <p className="text-sm text-foreground leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </blockquote>
                <figcaption className="flex items-center gap-3 mt-auto pt-4 border-t border-border">
                  <div
                    className={`size-9 rounded-full ${t.color} flex items-center justify-center text-xs font-bold shrink-0`}
                    aria-hidden="true"
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* 7 — CTA */}
        <CTA />
      </main>

      <Footer />
    </div>
  )
}
