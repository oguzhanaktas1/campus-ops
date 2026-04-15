'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CampusFlowLogo } from '@/components/campusflow-logo'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Menu, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NT } from '@/components/no-translate'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: number 
  children?: { label: string; href: string }[]
}

interface PortalLayoutProps {
  children: React.ReactNode
  navItems: NavItem[]
  portalName: string
  portalColor: string
  topbar: React.ReactNode
}

function SidebarNav({ navItems, portalName }: Pick<PortalLayoutProps, 'navItems' | 'portalName' | 'portalColor'>) {
  const pathname = usePathname()
  const searchParams = useSearchParams() 
  
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const isLinkActive = (href: string) => {
    if (href === '/') return pathname === '/'
    
    // 🔥 İKİLİ YANMA (ACTIVE HOVER) BUG FIXİ 🔥
    // Eğer link ana liste sayfasıysa, alt klasörlere girince yanmasını engelle.
    if (href === '/staff/requests' || href === '/student/requests' || href === '/faculty/requests') {
      return pathname === href
    }

    if (!href.includes('?')) return pathname.startsWith(href)
    
    const [basePath, queryString] = href.split('?')
    if (pathname !== basePath) return false
    
    const urlParams = new URLSearchParams(queryString)
    for (const [key, value] of urlParams.entries()) {
      if (searchParams.get(key) !== value) return false
    }
    return true
  }

  useEffect(() => {
    const newExpanded = { ...expanded }
    let hasChanges = false

    navItems.forEach(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => isLinkActive(child.href))
        if (hasActiveChild && !newExpanded[item.label]) {
          newExpanded[item.label] = true
          hasChanges = true
        }
      }
    })

    if (hasChanges) setExpanded(newExpanded)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  const toggleExpand = (label: string) => {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border flex-shrink-0">
        <CampusFlowLogo containerClassName="size-8" priority />
        <div>
          <NT as="p" className="text-sm font-bold text-sidebar-foreground">CampusFlow</NT>
          <p className="text-xs text-sidebar-foreground/60">{portalName}</p>
        </div>
      </div>

      {/* Navigasyon Alanı */}
      <div className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin scrollbar-thumb-sidebar-border scrollbar-track-transparent">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expanded[item.label]

            // TEKLİ LİNKLER
            if (!hasChildren) {
              const isActive = isLinkActive(item.href)
              return (
                <Link
                  key={item.label} 
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className="size-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  
                  {/* BADGE BASILAN YER */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-[10px] font-bold bg-destructive text-destructive-foreground min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              )
            }

            // ÇOCUKLU (Açılır-Kapanır) LİNKLER
            const parentActive = item.children!.some(child => isLinkActive(child.href))

            return (
              <div key={item.label} className="flex flex-col gap-0.5">
                <button
                  onClick={() => toggleExpand(item.label)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors w-full',
                    parentActive && !isExpanded 
                      ? 'text-sidebar-foreground font-semibold' 
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("size-4 flex-shrink-0", parentActive ? "text-primary" : "")} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown className={cn("size-4 transition-transform duration-200", isExpanded ? "rotate-180" : "")} />
                </button>
                
                {isExpanded && (
                  <div className="pl-9 pr-2 py-1 flex flex-col gap-1 overflow-hidden animate-in slide-in-from-top-2">
                    {item.children!.map((child) => {
                      const isChildActive = isLinkActive(child.href)
                      return (
                        <Link
                          key={child.label}
                          href={child.href}
                          className={cn(
                            'block py-1.5 px-2 text-sm rounded-md transition-colors',
                            isChildActive
                              ? 'bg-sidebar-accent/50 text-sidebar-foreground font-medium'
                              : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30'
                          )}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Alt Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border flex-shrink-0">
        <NT as="p" className="text-xs text-sidebar-foreground/40">CampusFlow v2.4.1</NT>
      </div>
    </div>
  )
}

export function PortalLayout({ children, navItems, portalName, portalColor, topbar }: PortalLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-56 flex-col flex-shrink-0 border-r border-border">
        <SidebarNav navItems={navItems} portalName={portalName} portalColor={portalColor} />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-56 bg-sidebar border-r border-sidebar-border">
          <SidebarNav navItems={navItems} portalName={portalName} portalColor={portalColor} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden size-8"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>
          {topbar}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
