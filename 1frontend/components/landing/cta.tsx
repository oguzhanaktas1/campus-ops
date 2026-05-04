'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { ArrowRight, Mail, PhoneCall } from 'lucide-react'

export function CTA() {
  const { t } = useI18n()

  return (
    <section
      id="contact"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24"
      aria-labelledby="cta-heading"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-indigo-600 px-8 py-16 sm:py-20 text-center shadow-xl shadow-primary/20">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10">
          <p className="text-primary-foreground/70 text-xs font-bold uppercase tracking-widest mb-4">
            {t('cta.eyebrow')}
          </p>
          <h2
            id="cta-heading"
            className="text-3xl sm:text-4xl font-extrabold text-primary-foreground text-balance mb-5"
          >
            {t('cta.title')}
          </h2>
          <p className="text-primary-foreground/75 mb-10 max-w-xl mx-auto text-balance text-lg leading-relaxed">
            {t('cta.subtitle')}
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap mb-8">
            <Link href="/login">
              <Button
                size="lg"
                className="gap-2 h-12 px-6 text-base bg-white text-primary hover:bg-white/90 shadow-lg shadow-black/10"
              >
                {t('cta.startTrial')} <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                size="lg"
                variant="ghost"
                className="gap-2 h-12 px-6 text-base text-primary-foreground hover:bg-white/10 hover:text-primary-foreground border border-white/20"
              >
                <PhoneCall className="size-4" />
                {t('cta.talkSales')}
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-sm text-primary-foreground/70">
            <Mail className="size-3.5" aria-hidden="true" />
            <span>{t('cta.questions')} </span>
            <a
              href="mailto:info@campusflow.com.tr"
              className="text-primary-foreground hover:underline font-medium"
            >
              info@campusflow.com.tr
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
