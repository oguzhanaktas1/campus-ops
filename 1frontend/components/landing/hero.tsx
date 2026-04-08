import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
      <Badge variant="outline" className="mb-6 text-primary border-primary/30 bg-primary/5">
        Built for University Ecosystems
      </Badge>
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight text-balance mb-6">
        Smart Campus Operations,
        <br />
        <span className="text-primary">Unified in One Platform</span>
      </h1>
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance mb-10 leading-relaxed">
        CampusOps connects students, faculty, staff, and administrators in one purpose-built platform.
        Eliminate paperwork, automate approvals, and keep your campus running at full speed.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Link href="/sign-up">
          <Button size="lg" className="gap-2">
            Start Free Trial <ArrowRight className="size-4" />
          </Button>
        </Link>
        <Link href="/login">
          <Button size="lg" variant="outline">
            View Demo Portals
          </Button>
        </Link>
      </div>
    </section>
  )
}