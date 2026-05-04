"use client";

import { useEffect, useState, useMemo } from "react";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Filter, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FacultyRequestsPage() {
  const { t } = useI18n();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const fetchAllRequests = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const res = await fetch(`${backendUrl}/faculty/requests/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRequests(data);
        }
      } catch (error) {
        console.error("Talepler çekilemedi:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.submittedByName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className="h-[50vh] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('requests.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('requests.subtitle', { count: requests.length })}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="h-10 px-3 py-2 bg-background border border-input rounded-md text-sm outline-none focus:ring-2 focus:ring-primary w-full sm:w-[180px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">{t('common.all')}</option>
          <option value="APPROVED">{t('common.approved')}</option>
          <option value="REJECTED">{t('common.rejected')}</option>
          <option value="SUBMITTED">{t('requests.submitted')}</option>
          <option value="REVISION_REQUESTED">{t('requests.revisionRequestedShort')}</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden text-card-foreground">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">{t('requests.colTitle')}</th>
                <th className="px-6 py-4">{t('internships.colStudent')}</th>
                <th className="px-6 py-4">{t('common.date')}</th>
                <th className="px-6 py-4">{t('common.status')}</th>
                <th className="px-6 py-4 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRequests.map((req) => (
                <tr
                  key={req.id}
                  className="hover:bg-muted/20 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <p className="font-semibold text-foreground">{req.title}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                      {req.typeName}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {req.submittedByName}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {formatDate(req.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/faculty/requests/${req.id}?from=/faculty/requests`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 group-hover:bg-primary group-hover:text-primary-foreground"
                      >
                        {t('requests.viewDetail')} <ArrowUpRight className="size-3" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRequests.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-muted-foreground">
                {t('requests.noRequests')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
