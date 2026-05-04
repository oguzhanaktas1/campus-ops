'use client'

import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { Stats } from '@/components/landing/stats'
import { CTA } from '@/components/landing/cta'
import { Footer } from '@/components/landing/footer'
import { useI18n } from '@/lib/i18n'
import {
  FileText, Calendar, BarChart3, ShieldCheck, Zap, Users,
  ClipboardList, CheckSquare, Bell,
} from 'lucide-react'

export function HomeLanding() {
  const { t } = useI18n()

  const features = [
    { icon: FileText, title: t('features.unifiedTitle'), description: t('features.unifiedDesc') },
    { icon: Calendar, title: t('features.schedulingTitle'), description: t('features.schedulingDesc') },
    { icon: BarChart3, title: t('features.analyticsTitle'), description: t('features.analyticsDesc') },
    { icon: ShieldCheck, title: t('features.accessTitle'), description: t('features.accessDesc') },
    { icon: Zap, title: t('features.workflowsTitle'), description: t('features.workflowsDesc') },
    { icon: Users, title: t('features.directoryTitle'), description: t('features.directoryDesc') },
  ]

  const howItWorks = [
    {
      step: '01',
      icon: ClipboardList,
      title: t('how.submitTitle'),
      description: t('how.submitDesc'),
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      border: 'border-blue-200 dark:border-blue-800',
    },
    {
      step: '02',
      icon: CheckSquare,
      title: t('how.routeTitle'),
      description: t('how.routeDesc'),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    {
      step: '03',
      icon: Bell,
      title: t('how.decisionTitle'),
      description: t('how.decisionDesc'),
      color: 'text-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
      border: 'border-purple-200 dark:border-purple-800',
    },
  ]

  const testimonials = [
    {
      quote: t('testimonials.quote1'),
      name: 'Dr. Ayse Korkmaz',
      role: t('testimonials.role1'),
      initials: 'AK',
      color: 'bg-emerald-100 text-emerald-700',
    },
    {
      quote: t('testimonials.quote2'),
      name: 'Mert Yildiz',
      role: t('testimonials.role2'),
      initials: 'MY',
      color: 'bg-blue-100 text-blue-700',
    },
    {
      quote: t('testimonials.quote3'),
      name: 'Elif Sahin',
      role: t('testimonials.role3'),
      initials: 'ES',
      color: 'bg-purple-100 text-purple-700',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Stats />

        <section
          id="features"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24"
          aria-labelledby="features-heading"
        >
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">{t('features.eyebrow')}</p>
            <h2
              id="features-heading"
              className="text-3xl sm:text-4xl font-extrabold text-foreground text-balance"
            >
              {t('features.title')}
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-balance">{t('features.subtitle')}</p>
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

        <section
          id="how-it-works"
          className="border-y border-border bg-muted/30 py-20 sm:py-24"
          aria-labelledby="how-heading"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">{t('how.eyebrow')}</p>
              <h2 id="how-heading" className="text-3xl sm:text-4xl font-extrabold text-foreground text-balance">
                {t('how.title')}
              </h2>
              <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-balance">{t('how.subtitle')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 relative">
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
                        aria-label={t('how.stepAria', { step: step.step })}
                      >
                        {step.step}
                      </span>
                    </div>
                    <h3 className="font-bold text-foreground text-base mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">{step.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section
          className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24"
          aria-labelledby="testimonials-heading"
        >
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">
              {t('testimonials.eyebrow')}
            </p>
            <h2
              id="testimonials-heading"
              className="text-3xl sm:text-4xl font-extrabold text-foreground text-balance"
            >
              {t('testimonials.title')}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((item) => (
              <figure
                key={item.name}
                className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col gap-4"
              >
                <blockquote>
                  <p className="text-sm text-foreground leading-relaxed">&ldquo;{item.quote}&rdquo;</p>
                </blockquote>
                <figcaption className="flex items-center gap-3 mt-auto pt-4 border-t border-border">
                  <div
                    className={`size-9 rounded-full ${item.color} flex items-center justify-center text-xs font-bold shrink-0`}
                    aria-hidden="true"
                  >
                    {item.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <CTA />
      </main>
      <Footer />
    </div>
  )
}
