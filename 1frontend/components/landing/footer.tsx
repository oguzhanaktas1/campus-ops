import Link from 'next/link'
import { GraduationCap } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-primary flex items-center justify-center">
            <GraduationCap className="size-3 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">CampusOps</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/features" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Features</Link>
          <Link href="/about" className="text-xs text-muted-foreground hover:text-foreground transition-colors">About</Link>
          <Link href="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
          <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Login</Link>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 CampusOps. All rights reserved.</p>
      </div>
    </footer>
  )
}