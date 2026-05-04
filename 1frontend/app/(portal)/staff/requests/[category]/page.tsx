'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation' // 🔥 useRouter EKLENDİ
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { Search, Filter, Loader2, ArrowRight, UserPlus, Server } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// URL formatını Backend Kategori formatına çeviriyoruz
const categoryMap: Record<string, { dbValue: string, title: string, desc: string }> = {
  'it-support': { dbValue: 'IT_SUPPORT', title: 'IT Support Tickets', desc: 'Manage network, hardware, and account access requests.' },
  'administrative': { dbValue: 'ADMINISTRATIVE', title: 'Administrative', desc: 'Manage document and procurement requests.' },
  'inventory': { dbValue: 'INVENTORY', title: 'Inventory & Equipment', desc: 'Manage consumable and equipment requests.' },
  'campus-services': { dbValue: 'CAMPUS_SERVICES', title: 'Campus Services', desc: 'Manage security and visitor pass requests.' },
  'student-life': { dbValue: 'STUDENT_LIFE', title: 'Student Life', desc: 'Manage clubs and student activity requests.' }
}

export default function CategoryRequestsPage() {
  const params = useParams()
  const router = useRouter() // 🔥 YÖNLENDİRME İÇİN EKLENDİ
  const { t } = useI18n()
  const slug = params.category as string 

  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'unassigned' | 'active' | 'closed'>('unassigned')
  const [searchQuery, setSearchQuery] = useState('')

  const categoryInfo = categoryMap[slug]

  useEffect(() => {
    if (!categoryInfo) return

    const fetchRequests = async () => {
      setIsLoading(true)
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        
        // Backend'e category parametresini yolluyoruz
        const res = await fetch(`${backendUrl}/staff/requests?filter=${activeTab}&category=${categoryInfo.dbValue}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (res.ok) {
          setRequests(await res.json())
        }
      } catch (err) {
        toast.error(t('requests.loadFail'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()
  }, [activeTab, categoryInfo, t])

  if (!categoryInfo) {
    return <div className="p-10 text-center text-muted-foreground">{t('pages.categoryNotFound')}</div>
  }

  const filteredRequests = requests.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.requestNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.requesterName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Server className="size-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{categoryInfo.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{categoryInfo.desc}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t('requests.searchPlaceholder')} 
              className="pl-9 h-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex space-x-1 bg-muted/50 p-1 rounded-lg w-fit border border-border">
        {[
          { id: 'unassigned', label: t('requests.needsAssignment') },
          { id: 'active', label: t('requests.active') },
          { id: 'all', label: t('requests.allRequests') },
          { id: 'closed', label: t('requests.closed') }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
              activeTab === tab.id 
                ? "bg-background text-foreground shadow-sm ring-1 ring-border" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredRequests.map((req) => (
              <div 
                key={req.id} 
                onClick={() => router.push(`/staff/requests/${slug}/${req.id}`)} // 🔥 SATIRI TIKLANABİLİR VE DİNAMİK YAPTIK 🔥
                className="p-4 hover:bg-muted/50 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group" // 🔥 group classı eklendi
              >
                <div className="flex-1 min-w-0 flex items-start gap-3">
                  <div className="mt-2 shrink-0">
                    <div className={cn(
                      "size-2.5 rounded-full",
                      req.status === 'SUBMITTED' ? 'bg-blue-500 animate-pulse' :
                      req.status === 'APPROVED' ? 'bg-emerald-500' :
                      req.status === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'
                    )} />
                  </div>
                  
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {req.requestNo}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    {/* 🔥 Link etiketi kaldırıldı, yerine hover animasyonu eklendi */}
                    <h3 className="text-base font-semibold text-foreground mt-1 truncate group-hover:text-primary transition-colors">
                      {req.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">
                      {t('requests.from')} <span className="font-medium text-foreground">{req.requesterName}</span> · {req.typeName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('pages.assignee')}</p>
                    {req.assignedTo ? (
                      <p className="text-sm font-medium text-foreground mt-0.5">{req.assignedTo}</p>
                    ) : (
                      <p className="text-sm font-medium text-amber-600 flex items-center gap-1 mt-0.5">
                        <UserPlus className="size-3" /> {t('common.unassigned')}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t('pages.created')}</p>
                    <p className="text-sm text-foreground mt-0.5">{formatDate(req.createdAt)}</p>
                  </div>

                  {/* 🔥 Buton kaldırıldı, temiz bir ok ikonu konuldu */}
                  <div className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                    <ArrowRight className="size-5" />
                  </div>
                </div>
              </div>
            ))}

            {filteredRequests.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-sm font-medium text-foreground">{t('pages.noTicketsFound')}</p>
                <p className="text-xs text-muted-foreground mt-1">There are no {categoryInfo.title.toLowerCase()} matching this criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
