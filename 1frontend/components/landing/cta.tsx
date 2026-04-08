import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function CTA() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
      <div className="bg-primary rounded-2xl px-8 py-14">
        <h2 className="text-3xl font-bold text-primary-foreground text-balance mb-4">
          Ready to modernize your campus operations?
        </h2>
        <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto text-balance">
          Join hundreds of institutions using CampusOps to streamline workflows, reduce administrative load, and improve student satisfaction.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="gap-2">
              Start Free Trial <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              Contact Sales
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}