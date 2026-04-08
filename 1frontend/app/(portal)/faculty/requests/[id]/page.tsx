"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { RequestTimeline } from "@/components/request-timeline";
import { CommentThread } from "@/components/comment-thread";
import { WorkflowStepIndicator } from "@/components/workflow-step-indicator";
import { ArrowLeft, Paperclip, Download, Loader2, FileText, CheckCircle2, GraduationCap } from "lucide-react";
import { toast } from "sonner";

// 🔥 ÖĞRENCİ TARAFINDAKİ GİBİ DİNAMİK WORKFLOW BUILDER EKLENDİ 🔥
const buildWorkflowSteps = (type: string, status: string) => {
  let labels = ["Submitted", "Under Review", "Approval", "Completed"];
  
  if (type === "internship") {
    labels = ["Submitted", "Faculty Review", "Dept Approval", "Finalized"];
  } else if (type === "it_support" || type === "network_issue" || type === "device_maintenance") {
    labels = ["Submitted", "Assigned", "In Progress", "Resolved"];
  } else if (type === "room_reservation" || type === "meeting_room_reservation" || type === "lab_reservation") {
    labels = ["Submitted", "Verified", "Confirmed"]; 
  }

  const steps = labels.map((label, idx) => ({
    id: idx + 1,
    label,
    status: "pending" as any,
  }));

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
  else if (s === "REVISION_REQUESTED") {
    steps[0].status = "completed";
    if (steps[1]) {
      steps[1].status = "warning"; 
      steps[1].label = "Revision Needed";
    }
  } 
  else if (s === "REJECTED") {
    steps[0].status = "completed";
    if (steps[1]) steps[1].status = "completed";
    const targetIdx = steps.length > 3 ? 2 : steps.length - 1;
    if (steps[targetIdx]) {
      steps[targetIdx].status = "failed"; 
      steps[targetIdx].label = "Rejected";
    }
  } 
  else if (s === "CANCELLED" || s === "EXPIRED") {
    steps[0].status = "completed";
    if (steps[1]) {
      steps[1].status = "failed";
      steps[1].label = s === "EXPIRED" ? "Expired" : "Cancelled";
    }
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
  });
}

export default function FacultyRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [request, setRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const res = await fetch(`${backendUrl}/faculty/requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setRequest(await res.json());
        }
      } catch (error) {
        toast.error("Failed to load request details");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRequest();
  }, [id]);

  const handleAddComment = async (text: string) => {
    try {
      const token = localStorage.getItem("access_token");
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const res = await fetch(`${backendUrl}/student/requests/${id}/comments`, {
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

  if (isLoading)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  if (!request)
    return (
      <div className="p-10 text-center text-muted-foreground">
        Request not found.
      </div>
    );

  // 🔥 Eski ilkel fonksiyon silindi, yeni Bordo Bereli Builder kullanılıyor 🔥
  const workflowSteps = buildWorkflowSteps(request.type, request.status);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      {/* ÜST BAR */}
      <div className="flex items-center gap-3">
        <Link href="/faculty/requests">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">
            {request.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {request.requestNo} · Official Faculty Record
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
        {/* SOL TARAF: İÇERİK */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="size-4 text-primary" /> Request Description
            </h2>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-4 rounded-lg border border-border/50">
              {request.description || "No description provided."}
            </div>
          </div>

          {request.attachments && request.attachments.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Attachments
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {request.attachments.map((att: any) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border group hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="size-8 rounded bg-background flex items-center justify-center border border-border">
                        <Paperclip className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate max-w-[140px]">
                          {att.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {att.size}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                      <a href={att.url} target="_blank" rel="noreferrer">
                        <Download className="size-4" />
                      </a>
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
            <CommentThread
              comments={request.comments ?? []}
              onAddComment={handleAddComment}
            />
          </div>
        </div>

        {/* SAĞ TARAF: ÖĞRENCİ VE TALEP BİLGİLERİ */}
        <div className="space-y-6">
          {/* ÖĞRENCİ BİLGİSİ (DETAILS İÇİNDE) */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Request & Student Details
              </h2>

              <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10 mb-4">
                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <GraduationCap className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {request.submittedByName}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">
                    ID: {request.studentNumber || "No ID"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 px-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Category
                  </span>
                  <span className="text-sm font-semibold text-foreground bg-muted/40 px-2 py-1 rounded w-fit capitalize">
                    {request.typeName}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Submission Date
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatDate(request.createdAt)}
                  </span>
                </div>
                {request.dueAt && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Due Date
                    </span>
                    <span className="text-sm font-medium text-amber-600">
                      {formatDate(request.dueAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* AKSİYON BUTONU (EĞER BEKLEMEDEYSE VEYA YENİDEN GÖNDERİLMİŞSE) */}
            {(request.status === "SUBMITTED" || request.status === "WAITING_APPROVAL") && (
              <Link href="/faculty/approvals" className="block">
                <Button className="w-full gap-2 shadow-sm" variant="default">
                  <CheckCircle2 className="size-4" /> Go to Decision Page
                </Button>
              </Link>
            )}
          </div>

          {/* TIMELINE (INTERNAL HISTORY) */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Activity Log
            </h2>
            <div className="pl-1">
              <RequestTimeline
                events={
                  request.timeline?.map((e: any) => ({
                    id: e.id,
                    status: e.status,
                    date: e.date,
                    note: e.note || "No additional notes provided.",
                  })) || []
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}