'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import { CommentThread } from '@/components/comment-thread'
import { WorkflowStepIndicator } from '@/components/workflow-step-indicator'
import { 
  ArrowLeft, Paperclip, Download, Loader2, FileText, CheckCircle2, GraduationCap, Server, ChevronDown, Search, UserCheck, UserPlus, X
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// 🔥 WORKFLOW BUILDER 🔥
const buildWorkflowSteps = (type: string, status: string) => {
  let labels = ["Submitted", "In Review", "In Progress", "Resolved"];
  
  if (type === "internship") {
    labels = ["Submitted", "Faculty Review", "Dept Approval", "Finalized"];
  } else if (type === "room_reservation" || type === "meeting_room_reservation" || type === "lab_reservation") {
    labels = ["Submitted", "Verified", "Confirmed"]; 
  }

  const steps = labels.map((label, idx) => ({ id: idx + 1, label, status: "pending" as any }));
  const s = status ? status.toUpperCase() : "DRAFT";

  if (s === "SUBMITTED") {
    steps[0].status = "active";
  } 
  else if (s === "IN_REVIEW" || s === "ASSIGNED") {
    steps[0].status = "completed";
    if (steps[1]) steps[1].status = "active";
  } 
  else if (s === "WAITING_APPROVAL" || s === "IN_PROGRESS") {
    steps[0].status = "completed";
    if (steps[1]) steps[1].status = "completed";
    if (steps[2]) steps[2].status = "active";
  } 
  else if (s === "APPROVED") {
    steps[0].status = "completed";
    if (steps[1]) steps[1].status = "completed";
    if (steps[2]) steps[2].status = "completed";
    if (steps[3]) steps[3].status = "active"; 
    if (steps.length === 3) steps[2].status = "completed"; 
  } 
  else if (s === "COMPLETED" || s === "RESOLVED" || s === "CLOSED") {
    steps.forEach(step => (step.status = "completed"));
  }
  else {
    steps[0].status = "active"; 
  }

  return steps;
};

function formatDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function RequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [request, setRequest] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 🔥 ASSIGN MENU STATELERİ 🔥
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [facultyList, setFacultyList] = useState<any[]>([])
  const [searchFaculty, setSearchFaculty] = useState("")
  const [selectedFaculty, setSelectedFaculty] = useState<any>(null) // 🔥 Seçilen ama onay bekleyen hoca
  const [isAssigning, setIsAssigning] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sayfa dışına tıklayınca dropdown kapansın
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAssignOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Sayfa Yüklenirken Verileri Çek
  useEffect(() => {
    const fetchDetailAndFaculty = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        
        // 1. Talebi Getir
        const resReq = await fetch(`${backendUrl}/staff/requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (resReq.ok) setRequest(await resReq.json())

        // 2. Hoca Listesini Getir
        const resFac = await fetch(`${backendUrl}/staff/faculty-members`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (resFac.ok) setFacultyList(await resFac.json())

      } catch (err) {
        toast.error('Veriler yüklenirken hata oluştu.')
      } finally {
        setIsLoading(false)
      }
    }

    if (id) fetchDetailAndFaculty()
  }, [id])

  // 🔥 GERÇEK ATAMA İŞLEMİ (ONAY BUTONUNA BASILINCA) 🔥
  const handleConfirmAssignment = async () => {
    if (!selectedFaculty) return;
    setIsAssigning(true)
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      
      const res = await fetch(`${backendUrl}/staff/requests/${id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assigneeId: selectedFaculty.id }),
      })

      if (res.ok) {
        const updatedRequest = await res.json()
        setRequest(updatedRequest) 
        setSelectedFaculty(null) // Onaylandığı için seçimi temizle
        toast.success("Ticket successfully assigned and locked!")
      } else {
        toast.error("Assignment failed.")
      }
    } catch (err) {
      toast.error("An error occurred during assignment.")
    } finally {
      setIsAssigning(false)
    }
  }

  const handleAddComment = async (text: string) => {
    try {
      const token = localStorage.getItem("access_token");
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const res = await fetch(`${backendUrl}/staff/requests/${id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setRequest((prev: any) => ({
          ...prev,
          comments: [...(prev.comments || []), newComment],
        }));
      }
    } catch (error) {
      toast.error("Could not post comment");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!request) {
    return <div className="p-10 text-center">Talep bulunamadı veya silinmiş.</div>
  }

  const workflowSteps = buildWorkflowSteps(request.requestType?.key, request.status);
  const isAlreadyAssigned = !!request.currentAssignee; // 🔥 ZATEN ATANMIŞ MI KONTROLÜ 🔥
  
  // Arama filtresi
  const filteredFaculty = facultyList.filter(f => 
    f.profile?.fullName?.toLowerCase().includes(searchFaculty.toLowerCase()) ||
    f.email?.toLowerCase().includes(searchFaculty.toLowerCase()) ||
    f.fullName?.toLowerCase().includes(searchFaculty.toLowerCase()) 
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      
      {/* ÜST BAR */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">
            {request.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {request.requestNo} · {request.requestType?.category || 'Staff Queue'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <PriorityBadge priority={request.priority} />
          <StatusBadge status={request.status} />
        </div>
      </div>

      {/* WORKFLOW ADIMLARI */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm overflow-hidden">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-6">
          Workflow Status
        </h2>
        <WorkflowStepIndicator steps={workflowSteps} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* SOL TARAF */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="size-4 text-primary" /> Request Description
            </h2>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-4 rounded-lg border border-border/50">
              {request.description || "No description provided."}
            </div>
          </div>

          {request.fileLinks && request.fileLinks.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Attachments
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {request.fileLinks.map((att: any) => (
                  <div key={att.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border group hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="size-8 rounded bg-background flex items-center justify-center border border-border">
                        <Paperclip className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{att.name || 'Attached File'}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{att.size || 'FILE'}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                      <a href={att.url || '#'} target="_blank" rel="noreferrer"><Download className="size-4" /></a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-6">
              Communication Thread
            </h2>
            <CommentThread comments={request.comments ?? []} onAddComment={handleAddComment} />
          </div>
        </div>

        {/* SAĞ TARAF */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-5">
            
            {/* TALEP EDEN KİŞİ BİLGİSİ */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Requester Details
              </h2>
              <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10 mb-4">
                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <GraduationCap className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{request.requester?.profile?.fullName || 'Unknown User'}</p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase truncate">{request.requester?.email || "No Email"}</p>
                </div>
              </div>
              <div className="space-y-3 px-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Category Type</span>
                  <span className="text-sm font-semibold text-foreground bg-muted/40 px-2 py-1 rounded w-fit capitalize">{request.requestType?.name || 'General Request'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Submission Date</span>
                  <span className="text-sm font-medium text-foreground">{formatDate(request.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* 🔥 ASSIGNMENT DURUMU VE ONAYLI DROPDOWN 🔥 */}
            <div className="pt-4 border-t border-border relative" ref={dropdownRef}>
               <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Current Assignment
               </h2>
               
               {/* 1. DURUM: ZATEN ATANMIŞ */}
               {isAlreadyAssigned ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-3">
                    <UserCheck className="size-5 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-emerald-700 font-bold uppercase">Assigned To</p>
                      <p className="text-sm font-semibold text-emerald-900 truncate">
                        {request.currentAssignee?.profile?.fullName || request.currentAssignee?.fullName}
                      </p>
                    </div>
                  </div>
               ) : selectedFaculty ? (
                  /* 2. DURUM: HOCA SEÇİLDİ, ONAY BEKLİYOR */
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-amber-700 font-bold uppercase">Ready to Assign</p>
                      <button onClick={() => setSelectedFaculty(null)} className="hover:bg-amber-500/20 p-1 rounded-full transition-colors">
                        <X className="size-3 text-amber-700" />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-amber-900">{selectedFaculty.profile?.fullName || selectedFaculty.fullName}</p>
                    <Button 
                      className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white" 
                      onClick={handleConfirmAssignment}
                      disabled={isAssigning}
                    >
                      {isAssigning ? <Loader2 className="size-3 animate-spin mr-2" /> : <CheckCircle2 className="size-3 mr-2" />}
                      Confirm Assignment
                    </Button>
                  </div>
               ) : (
                  /* 3. DURUM: HİÇ KİMSE ATANMAMIŞ, SEÇİM BEKLİYOR */
                  <div className="p-3 bg-muted/50 border border-dashed border-border rounded-lg text-center mb-3">
                    <p className="text-xs text-muted-foreground font-medium">No one assigned yet.</p>
                  </div>
               )}

               {/* Arama Çubuklu Dropdown Butonu (Sadece atanmamışsa ve seçim yapılmamışsa görünür) */}
               {!isAlreadyAssigned && !selectedFaculty && (
                 <div className="relative mt-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-between h-10 border-primary/20 hover:border-primary/40" 
                      onClick={() => setIsAssignOpen(!isAssignOpen)}
                    >
                      <div className="flex items-center gap-2">
                        <UserPlus className="size-4 text-primary" />
                        <span className="text-sm">Select Faculty</span>
                      </div>
                      <ChevronDown className="size-4 opacity-50" />
                    </Button>

                    {/* Açılır Menü (Arama Çubuğu + Liste) */}
                    {isAssignOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg animate-in fade-in zoom-in-95">
                        <div className="p-2 border-b border-border">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                              autoFocus
                              type="text"
                              className="w-full pl-8 pr-2 py-1.5 text-sm bg-muted/50 border border-transparent rounded-sm outline-none focus:border-primary/50 focus:bg-background transition-colors placeholder:text-muted-foreground"
                              placeholder="Search faculty..."
                              value={searchFaculty}
                              onChange={(e) => setSearchFaculty(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                          {filteredFaculty.length > 0 ? (
                            filteredFaculty.map(f => (
                              <button 
                                key={f.id}
                                onClick={() => { setSelectedFaculty(f); setIsAssignOpen(false); }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
                              >
                                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-[10px] text-primary">
                                  {(f.profile?.fullName || f.fullName || '?').charAt(0)}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-foreground truncate">{f.profile?.fullName || f.fullName || 'No Name'}</span>
                                  <span className="text-[10px] text-muted-foreground truncate">{f.email}</span>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="text-xs text-center text-muted-foreground py-4">No faculty found.</p>
                          )}
                        </div>
                      </div>
                    )}
                 </div>
               )}

               {/* Zaten atanmışsa çıkan not */}
               {isAlreadyAssigned && (
                 <p className="text-[10px] text-center text-muted-foreground mt-3 italic">
                   This ticket is locked to the assigned faculty member.
                 </p>
               )}
            </div>

          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Activity Log
            </h2>
            <div className="pl-1">
              <RequestTimeline
                events={
                  request.history?.map((e: any) => ({
                    id: e.id,
                    status: e.status,
                    date: e.createdAt,
                    note: e.changeReason || e.note || "System update",
                  })) || []
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}