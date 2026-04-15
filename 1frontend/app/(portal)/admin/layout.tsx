"use client";

import { useEffect, useState } from "react";
import { PortalLayout, type NavItem } from "@/components/portal-layout";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Settings,
  Bell,
  ShieldCheck,
  Loader2,
  Building2,
  Activity,
  ClipboardList,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard/auth-guard";
import { fetchProfile, getStoredUser } from "@/lib/auth";

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "Users & Access",
    href: "#",
    icon: Users,
    children: [
      { label: "Users", href: "/admin/users" },
      { label: "Roles", href: "/admin/roles" },
      { label: "Permissions", href: "/admin/permissions" },
    ],
  },
  {
    label: "Organization",
    href: "#",
    icon: Building2,
    children: [
      { label: "Campuses", href: "/admin/campuses" },
      { label: "Faculties", href: "/admin/faculties" },
      { label: "Departments", href: "/admin/departments" },
      { label: "Units", href: "/admin/units" },
    ],
  },
  {
    label: "Requests",
    href: "#",
    icon: FileText,
    children: [
      { label: "All Requests", href: "/admin/requests" },
      { label: "Request Types", href: "/admin/request-types" },
    ],
  },
  {
    label: "Workflows",
    href: "#",
    icon: ClipboardList,
    children: [
      { label: "Workflows", href: "/admin/workflows" },
      { label: "Workflow Instances", href: "/admin/workflow-instances" },
    ],
  },
  {
    label: "Operations",
    href: "#",
    icon: Activity,
    children: [
      { label: "Resources", href: "/admin/resources" },
      { label: "SLA Policies", href: "/admin/sla" },
    ],
  },
  {
    label: "System",
    href: "#",
    icon: ClipboardList,
    children: [
      { label: "Integrations", href: "/admin/integrations" },
      { label: "Webhook Logs", href: "/admin/webhook-logs" },
      { label: "System Events", href: "/admin/system-events" },
      { label: "Audit Logs", href: "/admin/audit-logs" },
    ],
  },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Reports", href: "/admin/reports", icon: BarChart3 },
  { label: "Notifications", href: "/admin/notifications", icon: Bell },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      const storedUser = getStoredUser();
      if (!storedUser) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await fetchProfile();
        setUser(profile);
      } catch (error) {
        console.error("Profile fetch failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchUserProfile();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const topbar = (
    <div className="flex items-center justify-between flex-1">
      <div className="hidden sm:flex items-center gap-2">
        <ShieldCheck className="size-4 text-primary" />
        <div>
          <h1 className="text-sm font-semibold text-foreground">Admin Portal</h1>
          <p className="text-xs text-muted-foreground">
            {user.title} · {user.department}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <ThemeToggle />
        <LanguageSwitcher />
        <NotificationBell role="admin" />
        <ProfileDropdown user={user} settingsHref="/admin/settings" />
      </div>
    </div>
  );

  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <PortalLayout
        navItems={navItems}
        portalName="Admin Portal"
        portalColor="indigo"
        topbar={topbar}
      >
        {children}
      </PortalLayout>
    </AuthGuard>
  );
}
