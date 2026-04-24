'use client'

import { useEffect, useState, useMemo } from 'react'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Search, FileText, Trash2, Loader2, AlertTriangle, ArrowRight, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

const requestTypeLabels: Record<string, string> = {
  ACCESS_REQUEST: 'Access / Permission Request',
  APPOINTMENT: 'Appointment Request',
  DOCUMENT_REQUEST: 'Document Request',
  EQUIPMENT: 'Equipment Request',
  EVENT_CREATION_REQUEST: 'Event Creation Request',
  EVENT_REQUEST: 'Event / Activity Request',
  INTERNSHIP_REQUEST: 'Internship Application',
  IT_TICKET: 'IT Support Ticket',
  PROCUREMENT_REQUEST: 'Procurement Request',
  ROOM_RESERVATION: 'Room / Resource Reservation',
}

function getRequestTypeLabel(request: { type?: string; typeName?: string }) {
  if (request.type && requestTypeLabels[request.type]) return requestTypeLabels[request.type]
  return request.typeName ?? request.type ?? 'Unknown'
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  
  // 🔥 TOPLU SEÇİM STATE'LERİ 🔥
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/admin/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) setRequests(await res.json())
    } catch (err) {
      toast.error("Could not load system requests")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  // TOPLU SİLME FONKSİYONU
  const handleBulkDelete = async () => {
    setIsDeleting(true)
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/admin/requests/bulk-delete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ ids: selectedIds })
      })

      if (res.ok) {
        toast.success(`${selectedIds.length} requests deleted successfully`)
        setRequests(prev => prev.filter(r => !selectedIds.includes(r.id)))
        setSelectedIds([]) // Seçimleri temizle
      } else {
        toast.error("Failed to delete selected requests")
      }
    } catch (err) {
      toast.error("Network error")
    } finally {
      setIsDeleting(false)
      setShowConfirmModal(false)
    }
  }

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const matchesSearch =
        search === '' ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.submittedByName.toLowerCase().includes(search.toLowerCase()) ||
        r.requestNo.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase()
      const matchesType =
        typeFilter === 'all' ||
        r.type === typeFilter ||
        r.typeName?.toLowerCase() === typeFilter.toLowerCase()
      return matchesSearch && matchesStatus && matchesType
    })
  }, [requests, search, statusFilter, typeFilter])

  const requestTypes = useMemo(() => {
    const map = new Map<string, string>()
    for (const request of requests) {
      if (request.type) {
        map.set(request.type, getRequestTypeLabel(request))
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [requests])

  // HEPSİNİ SEÇ / KALDIR
  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map(r => r.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  if (isLoading) return <div className="h-[80vh] flex items-center justify-center"><Loader2 className="size-10 animate-spin text-primary" /></div>

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-20 relative">
      
      {/* ONAY MODALI */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                <AlertTriangle className="size-6" />
              </div>
              <h2 className="text-lg font-bold">Delete {selectedIds.length} items?</h2>
              <p className="text-sm text-muted-foreground">These requests and all their data will be permanently removed.</p>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" disabled={isDeleting} onClick={() => setShowConfirmModal(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={isDeleting} onClick={handleBulkDelete}>
                {isDeleting ? <Loader2 className="size-4 animate-spin" /> : "Delete Selected"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TOPBAR & BULK ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
            <FileText className="size-7 text-primary" /> System Audit
          </h1>
          <p className="text-sm text-muted-foreground">Managing {requests.length} requests in total.</p>
        </div>

        {/* 🔥 SEÇİLEN VARSA ÇIKAN BUTON 🔥 */}
        {selectedIds.length > 0 && (
          <Button 
            variant="destructive" 
            size="sm" 
            className="animate-in slide-in-from-right-4 gap-2 font-bold shadow-lg"
            onClick={() => setShowConfirmModal(true)}
          >
            <Trash2 className="size-4" /> Delete Selected ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* SEARCH & FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-muted/20 p-4 rounded-xl border border-border">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="Search title, ID, or student..." 
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="bg-background border border-input rounded-md px-3 text-sm focus:ring-2 focus:ring-primary outline-none h-10"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="REVISION_REQUESTED">Revision Req.</option>
        </select>
        <select
          className="bg-background border border-input rounded-md px-3 text-sm focus:ring-2 focus:ring-primary outline-none h-10"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          {requestTypes.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-center text-xs font-bold text-muted-foreground bg-background border border-border rounded-md uppercase">
          {filtered.length} visible
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-5 py-4 w-10">
                  <button 
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center hover:text-primary transition-colors"
                  >
                    {selectedIds.length === filtered.length && filtered.length > 0 ? (
                      <CheckSquare className="size-5 text-primary" />
                    ) : (
                      <Square className="size-5" />
                    )}
                  </button>
                </th>
                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-widest">Request</th>
                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-widest">Type</th>
                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-widest">Student</th>
                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-widest">Status</th>
                <th className="px-5 py-4 font-bold uppercase text-[10px] tracking-widest text-right">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((req) => (
                <tr 
                  key={req.id} 
                  className={cn(
                    "hover:bg-muted/30 transition-colors group",
                    selectedIds.includes(req.id) && "bg-primary/5"
                  )}
                >
                  <td className="px-5 py-4">
                    <button onClick={() => toggleSelect(req.id)}>
                      {selectedIds.includes(req.id) ? (
                        <CheckSquare className="size-5 text-primary animate-in zoom-in-50" />
                      ) : (
                        <Square className="size-5 text-muted-foreground/30 group-hover:text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-foreground leading-none">{req.title}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1.5">{req.requestNo}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 rounded bg-secondary text-[10px] font-bold text-secondary-foreground">
                      {getRequestTypeLabel(req)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20">
                        {req.submittedByName.charAt(0)}
                      </div>
                      <span className="text-xs font-medium">{req.submittedByName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/admin/requests/${req.id}`}>
                      <Button variant="ghost" size="icon" className="size-8 group-hover:bg-primary group-hover:text-white transition-all">
                        <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
