"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { RequestTimeline } from "@/components/request-timeline";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  Loader2,
  Info,
  ListChecks,
  Calendar, // 🔥 YENİ EKLENDİ
  Lock,     // 🔥 YENİ EKLENDİ
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ActionType = "approve" | "reject" | "revision" | null;

function formatDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// 🔥 GOOGLE TAKVİM URL OLUŞTURUCU 🔥
const generateGoogleCalendarUrl = (request: any) => {
  if (!request?.dynamicData) return null;
  
  const dateKey = Object.keys(request.dynamicData).find(k => k.toLowerCase().includes('date'));
  const timeKey = Object.keys(request.dynamicData).find(k => k.toLowerCase().includes('time'));
  
  if (!dateKey || !timeKey) return null;

  const dateVal = request.dynamicData[dateKey]; // "2026-04-15"
  const timeVal = String(request.dynamicData[timeKey]).replace(':', ''); // "14:30" -> "1430"

  // Google Calendar formatı: YYYYMMDDTHHMMSSZ
  const startDateStr = dateVal.replace(/-/g, '') + 'T' + timeVal + '00';
  const endDateStr = dateVal.replace(/-/g, '') + 'T' + (parseInt(timeVal) + 100).toString() + '00';

  const title = encodeURIComponent(`[CampusOps] ${request.title}`);
  const details = encodeURIComponent(`Student: ${request.submittedByName}\nDetails: ${request.description}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateStr}/${endDateStr}&details=${details}`;
};

export default function FacultyApprovalsPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<Record<string, ActionType>>({});

  const fetchPendingRequests = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const res = await fetch(`${backendUrl}/faculty/requests/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPending(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData?.message || "Failed to load pending requests.");
      }
    } catch (error) {
      toast.error("Failed to load pending requests.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const selected = pending.find((r) => r.id === selectedId);

  const handleAction = async (action: ActionType) => {
    if (!selectedId || !action) return;

    if ((action === "reject" || action === "revision") && comment.trim() === "") {
      toast.error(`A comment is required to ${action} this request.`);
      return;
    }

    setIsProcessing(true);
    try {
      const token = localStorage.getItem("access_token");
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

      const res = await fetch(`${backendUrl}/faculty/requests/${selectedId}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, comment }),
      });

      if (res.ok) {
        toast.success(`Request successfully marked as ${action}d!`);
        setDone((prev) => ({ ...prev, [selectedId]: action }));
        setComment("");

        // İşlem bitince kısa bir süre sonra listeden düşürüp bir sonrakine geçiyoruz
        setTimeout(() => {
          setPending(prev => prev.filter(p => p.id !== selectedId));
          const next = pending.find((r) => r.id !== selectedId && !done[r.id]);
          setSelectedId(next ? next.id : null);
        }, 3000); // Hocanın takvime ekle butonunu görebilmesi için 3 saniye süre verdik
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Failed to process request");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* SOL: BEKLEYENLER LİSTESİ */}
      <div className="lg:w-80 flex-shrink-0 border-r border-border overflow-y-auto bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Pending Approvals</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pending.filter((p) => !done[p.id]).length} requires action
          </p>
        </div>
        <div className="divide-y divide-border">
          {pending.map((req) => {
            const doneAction = done[req.id];
            return (
              <button
                key={req.id}
                onClick={() => setSelectedId(req.id)}
                className={cn(
                  "w-full text-left px-4 py-3.5 flex items-start gap-2 hover:bg-muted/30 transition-colors",
                  selectedId === req.id && "bg-primary/5 border-r-2 border-r-primary",
                  doneAction && "opacity-50 pointer-events-none" // 🔥 Tıklanmayı engelle
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{req.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {req.submittedByName} · {formatDate(req.createdAt)}
                  </p>
                  {doneAction && (
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-bold mt-1 uppercase tracking-wider",
                      doneAction === "approve" && "text-emerald-600",
                      doneAction === "reject" && "text-destructive",
                      doneAction === "revision" && "text-amber-600"
                    )}>
                      {doneAction === "approve" && <CheckCircle2 className="size-3" />}
                      {doneAction === "reject" && <XCircle className="size-3" />}
                      {doneAction === "revision" && <RotateCcw className="size-3" />}
                      {doneAction}D
                    </span>
                  )}
                </div>
                <ChevronRight className="size-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              </button>
            );
          })}
          {pending.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="size-10 text-emerald-500/20 mb-3" />
              <p className="text-sm font-medium text-foreground">All Caught Up!</p>
              <p className="text-xs text-muted-foreground mt-1">No requests pending your approval.</p>
            </div>
          )}
        </div>
      </div>

      {/* SAĞ: TALEP DETAYI VE AKSİYONLAR */}
      <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a request to review
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            <div>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{selected.title}</h1>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span className="font-medium text-primary">{selected.submittedByName}</span>
                    <span>•</span> {formatDate(selected.createdAt)}
                    <span>•</span> {selected.typeName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={selected.priority} />
                  <StatusBadge
                    status={
                      done[selected.id]
                        ? done[selected.id] === "approve" ? "APPROVED" : done[selected.id] === "reject" ? "REJECTED" : "REVISION_REQUESTED"
                        : selected.status
                    }
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="size-4 text-muted-foreground" /> Request Description
              </p>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {selected.description || "No description provided."}
              </div>
            </div>

            {selected.formSchema && selected.formSchema.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ListChecks className="size-4 text-muted-foreground" /> Specific Form Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border border-border/50">
                  {selected.formSchema.map((field: any) => {
                    const answer = selected.dynamicData?.[field.id] || selected[field.id];
                    return (
                      <div key={field.id} className={field.gridCols === 2 ? "col-span-1 sm:col-span-2" : "col-span-1"}>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                          {field.label}
                        </p>
                        <p className="text-sm font-medium text-foreground bg-background px-3 py-2 rounded-md border border-border/50">
                          {answer ? String(answer) : <span className="text-muted-foreground italic">Not provided</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 🔥 KARAR ALANI VE KİLİT MEKANİZMASI 🔥 */}
            {done[selected.id] || (selected.status === 'APPROVED' || selected.status === 'REJECTED' || selected.status === 'REVISION_REQUESTED') ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-6 rounded-lg flex flex-col items-center text-center gap-4">
                <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <Lock className="size-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Action Recorded</h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-1">This request has been successfully processed and is now locked.</p>
                </div>

                {/* TAKVİME EKLE BUTONU (Sadece Approve yapıldıysa ve tarih verisi varsa) */}
                {done[selected.id] === "approve" && generateGoogleCalendarUrl(selected) && (
                  <a 
                    href={generateGoogleCalendarUrl(selected)!} 
                    target="_blank" 
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-xs font-bold transition-colors shadow-sm"
                  >
                    <Calendar className="size-4" /> Add to Google Calendar
                  </a>
                )}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-foreground">Faculty Decision</p>
                  {comment.trim() === "" && (
                    <p className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded">
                      Comment required for Reject/Revision
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <Textarea
                    placeholder="Provide your reasoning or feedback here (Required for Reject/Revision)..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="resize-none min-h-[100px] border-muted-foreground/20 focus:border-primary"
                    disabled={isProcessing}
                  />
                  <div className="flex gap-3 flex-wrap">
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none" disabled={isProcessing} onClick={() => handleAction("approve")}>
                      {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve
                    </Button>
                    <Button variant="destructive" className="gap-2 flex-1 sm:flex-none" disabled={isProcessing} onClick={() => handleAction("reject")}>
                      {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Reject
                    </Button>
                    <Button variant="outline" className="gap-2 flex-1 sm:flex-none border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800" disabled={isProcessing} onClick={() => handleAction("revision")}>
                      {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Request Revision
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selected.timeline && selected.timeline.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-4">Activity History</p>
                <RequestTimeline events={selected.timeline} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}