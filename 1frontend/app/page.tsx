import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { Stats } from '@/components/landing/stats'
import { RoleCards } from '@/components/landing/role-cards'
import { CTA } from '@/components/landing/cta'
import { Footer } from '@/components/landing/footer'

// Feature bölümünü de istersen ayırabilirsin ama şimdilik burada kalsın
import { FileText, Calendar, BarChart3, ShieldCheck, Zap, Users } from 'lucide-react'

const features = [
  { icon: FileText, title: 'Unified Request Management', description: 'Students submit requests across departments.' },
  { icon: Calendar, title: 'Appointment Scheduling', description: 'Book meetings and reserve campus spaces.' },
  { icon: BarChart3, title: 'Real-time Analytics', description: 'Track request volumes and performance.' },
  { icon: ShieldCheck, title: 'Role-Based Access', description: 'Four distinct portals for each campus role.' },
  { icon: Zap, title: 'Automated Workflows', description: 'Define multi-step approval chains easily.' },
  { icon: Users, title: 'Campus Directory', description: 'Unified user management and grouping.' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        
        {/* Features Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Everything your campus needs</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-lg p-6 shadow-sm">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        <RoleCards />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}