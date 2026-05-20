"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalLayout, type NavItem } from "@/components/portal-layout";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AdminI18nProvider } from "@/components/admin/admin-i18n-provider";
import { useI18n } from "@/lib/i18n";
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
  MonitorDot,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard/auth-guard";
import { PortalAssistant } from "@/components/ai/portal-assistant";
import { fetchProfile, getStoredUser } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/providers/realtime-provider";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { t } = useI18n();

  const navItems: NavItem[] = [
    { label: t('nav.dashboard'), href: "/admin/dashboard", icon: LayoutDashboard },
    {
      label: t('nav.usersAccess'),
      href: "#",
      icon: Users,
      children: [
        { label: t('nav.users'), href: "/admin/users" },
        { label: t('nav.roles'), href: "/admin/roles" },
        { label: t('nav.permissions'), href: "/admin/permissions" },
      ],
    },
    {
      label: t('nav.organization'),
      href: "#",
      icon: Building2,
      children: [
        { label: t('nav.campuses'), href: "/admin/campuses" },
        { label: t('nav.faculties'), href: "/admin/faculties" },
        { label: t('nav.departments'), href: "/admin/departments" },
        { label: t('nav.units'), href: "/admin/units" },
      ],
    },
    {
      label: t('nav.requests'),
      href: "#",
      icon: FileText,
      children: [
        { label: t('nav.allRequests'), href: "/admin/requests" },
        { label: t('nav.requestTypes'), href: "/admin/request-types" },
      ],
    },
    {
      label: t('nav.workflows'),
      href: "#",
      icon: ClipboardList,
      children: [
        { label: t('nav.workflows'), href: "/admin/workflows" },
        { label: t('nav.workflowInstances'), href: "/admin/workflow-instances" },
      ],
    },
    {
      label: t('nav.operations'),
      href: "#",
      icon: Activity,
      children: [
        { label: t('nav.resources'), href: "/admin/resources" },
        { label: t('nav.slaPolicies'), href: "/admin/sla" },
      ],
    },
    {
      label: t('nav.systemMenu'),
      href: "#",
      icon: ClipboardList,
      children: [
        { label: t('nav.monitoring'), href: "/admin/monitoring" },
        { label: t('nav.integrations'), href: "/admin/integrations" },
        { label: t('nav.webhookLogs'), href: "/admin/webhook-logs" },
        { label: t('nav.systemEvents'), href: "/admin/system-events" },
        { label: t('nav.auditLogs'), href: "/admin/audit-logs" },
      ],
    },
    { label: t('nav.analytics'), href: "/admin/analytics", icon: BarChart3 },
    { label: t('nav.reports'), href: "/admin/reports", icon: BarChart3 },
    { label: t('nav.notifications'), href: "/admin/notifications", icon: Bell },
    { label: t('nav.settings'), href: "/admin/settings", icon: Settings },
  ];

  useEffect(() => {
    const fetchUserProfile = async () => {
      const storedUser = getStoredUser();
      if (!storedUser) {
        router.replace('/login');
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
  }, [router]);

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
          <h1 className="text-sm font-semibold text-foreground">{t('nav.adminPortal')}</h1>
          <p className="text-xs text-muted-foreground">
            {user.title} · {user.department}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationBell role="admin" />
        <ProfileDropdown user={user} settingsHref="/admin/settings" />
      </div>
    </div>
  );

  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <PortalLayout
        navItems={navItems}
        portalName={t('nav.adminPortal')}
        portalColor="indigo"
        topbar={topbar}
      >
        {children}
        <PortalAssistant
          portal="admin"
          title={t('assistant.title')}
          description={t('assistant.description')}
          prompts={[
            t('assistant.analyticsPrompt'),
            t('assistant.webhookPrompt'),
            t('assistant.workflowPrompt'),
          ]}
        />
      </PortalLayout>
    </AuthGuard>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminI18nProvider>
      <RealtimeProvider>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </RealtimeProvider>
    </AdminI18nProvider>
  );
}
