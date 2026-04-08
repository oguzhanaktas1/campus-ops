"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { RequestTimeline } from "@/components/request-timeline";
import { CommentThread } from "@/components/comment-thread";
import { WorkflowStepIndicator } from "@/components/workflow-step-indicator";
import { ArrowLeft, Paperclip, Download, Loader2, Users, Pencil, Package } from "lucide-react";

// 🔥 DİNAMİK WORKFLOW BUILDER 🔥
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

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [request, setRequest] = useState<any>(null);
  const [equipmentDetail, setEquipmentDetail] = useState<any>(null);
  const [ticketDetail, setTicketDetail] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const res = await fetch(`${backendUrl}/student/requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRequest(data);

          if (data.type === "EQUIPMENT") {
            const eqRes = await fetch(`${backendUrl}/equipment-requests/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (eqRes.ok) {
              const eqData = await eqRes.json();
              setEquipmentDetail(eqData.equipment ?? null);
            }
          } else if (data.type === "IT_SUPPORT") {
            const itRes = await fetch(`${backendUrl}/it-tickets/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (itRes.ok) {
              const itData = await itRes.json();
              setTicketDetail(itData.ticket ?? null);
            }
          }
        }
      } catch (error) {
        console.error("Talep detayı çekilemedi:", error);
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
      console.error("API Hatası:", error);
    }
  };

  if (isLoading)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );

  if (!request) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Request not found.</p>
        <Link href="/student/requests">
          <Button variant="outline" size="sm" className="mt-3">
            Back to Requests
          </Button>
        </Link>
      </div>
    );
  }

  const workflowSteps = buildWorkflowSteps(request.type, request.status);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* ÜST BAR VE BUTONLAR */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href="/student/requests">
            <Button variant="ghost" size="icon" className="size-8 shrink-0">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              {request.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {request.requestNo} · Submitted {formatDate(request.createdAt)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:ml-auto">
          {/* 🔥 SİHİRLİ EDİT BUTONU (Sadece Revize İstenmişse Çıkar) 🔥 */}
          {request.status === "REVISION_REQUESTED" && (
            <Link href={`/student/requests/${request.id}/edit?type=${request.type}`}>
              <Button variant="default" size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-sm">
                <Pencil className="size-3.5" /> Fix & Resubmit
              </Button>
            </Link>
          )}
          <PriorityBadge priority={request.priority} />
          <StatusBadge status={request.status} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          Workflow Progress
        </h2>
        <WorkflowStepIndicator steps={workflowSteps} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Description
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {request.description || "No description provided."}
            </p>
          </div>

          {/* Equipment detail card */}
          {equipmentDetail && (
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Package className="size-4 text-muted-foreground" /> Equipment Details
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  { label: "Equipment", value: equipmentDetail.equipmentName },
                  { label: "Category", value: equipmentDetail.equipmentCategory },
                  { label: "Quantity", value: equipmentDetail.quantity != null ? String(equipmentDetail.quantity) : null },
                  { label: "Purpose", value: equipmentDetail.purpose },
                  { label: "Needed From", value: equipmentDetail.neededFrom ? formatDate(equipmentDetail.neededFrom) : null },
                  { label: "Needed Until", value: equipmentDetail.neededUntil ? formatDate(equipmentDetail.neededUntil) : null },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                      <p className="text-foreground">{value}</p>
                    </div>
                  ) : null
                )}
                {equipmentDetail.urgencyReason && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Urgency Reason</p>
                    <p className="text-foreground">{equipmentDetail.urgencyReason}</p>
                  </div>
                )}
                {equipmentDetail.stockCheckStatus && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Stock Status</p>
                    <p className="text-foreground">{equipmentDetail.stockCheckStatus.replace(/_/g, " ")}</p>
                  </div>
                )}
                {equipmentDetail.estimatedCost != null && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Estimated Cost</p>
                    <p className="text-foreground">${Number(equipmentDetail.estimatedCost).toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* IT Ticket detail card */}
          {ticketDetail && (
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Package className="size-4 text-muted-foreground" /> IT Ticket Details
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  { label: "Category", value: ticketDetail.category },
                  { label: "Subcategory", value: ticketDetail.subcategory },
                  { label: "Affected System", value: ticketDetail.affectedSystem },
                  { label: "Location", value: ticketDetail.locationText },
                  { label: "Status", value: ticketDetail.ticketStatus?.replace(/_/g, " ") },
                  { label: "Asset ID", value: ticketDetail.assetId },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                      <p className="text-foreground">{value}</p>
                    </div>
                  ) : null
                )}
                {ticketDetail.resolutionSummary && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Resolution</p>
                    <p className="text-foreground">{ticketDetail.resolutionSummary}</p>
                  </div>
                )}
                {ticketDetail.assignedTo && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Assigned To</p>
                    <p className="text-foreground">{ticketDetail.assignedTo.fullName}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {request.attachments && request.attachments.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Attachments
              </h2>
              <div className="space-y-2">
                {request.attachments.map((att: any) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-2.5">
                      <Paperclip className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {att.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {att.size}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="size-7">
                      <Download className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Comments
            </h2>
            <CommentThread
              comments={request.comments ?? []}
              onAddComment={handleAddComment}
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Details</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium capitalize">
                  {request.type?.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <span className="font-medium">
                  <PriorityBadge priority={request.priority} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">
                  <StatusBadge status={request.status} />
                </span>
              </div>

              {request.assignedToNames &&
                request.assignedToNames.length > 0 && (
                  <div className="border-t border-border pt-2.5 mt-2.5">
                    <span className="text-muted-foreground flex items-center gap-1.5 mb-2">
                      <Users className="size-3.5" /> Assigned Faculty (
                      {request.assignedToNames.length})
                    </span>
                    <div className="flex flex-col gap-1.5 pl-5 border-l-2 border-primary/20">
                      {request.assignedToNames.map(
                        (name: string, i: number) => (
                          <span
                            key={i}
                            className="font-medium text-foreground text-xs"
                          >
                            {name}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {request.dueAt && (
                <div className="flex justify-between border-t border-border pt-2.5 mt-2.5">
                  <span className="text-muted-foreground">Due Date</span>
                  <span className="font-medium">
                    {formatDate(request.dueAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {request.timeline && request.timeline.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Activity
              </h2>
              <RequestTimeline events={request.timeline} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}