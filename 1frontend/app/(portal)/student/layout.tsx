"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalLayout, type NavItem } from "@/components/portal-layout";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { StudentI18nProvider } from "@/components/student/student-i18n-provider";
import { useI18n } from "@/lib/i18n";
import {
  LayoutDashboard,
  FileText,
  Calendar,
  FolderOpen,
  Bell,
  Settings,
  Loader2,
  GraduationCap,
  Briefcase,
  CalendarDays,
  Building2,
  Package,
  ShoppingCart,
  ShieldCheck,
  PartyPopper,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard/auth-guard";
import { PortalAssistant } from "@/components/ai/portal-assistant";
import { fetchProfile, getStoredUser, getToken } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/providers/realtime-provider";
import { NotificationToastProvider } from "@/lib/providers/notification-toast-provider";

function StudentLayoutInner({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { t } = useI18n();

  const navItems: NavItem[] = [
    { label: t("nav.dashboard"), href: "/student/dashboard", icon: LayoutDashboard },
    { label: t("nav.requests"), href: "/student/requests", icon: FileText },
    { label: t("nav.documents"), href: "/student/documents", icon: GraduationCap },
    { label: t("nav.reservations"), href: "/student/reservations", icon: Building2 },
    { label: t("nav.appointments"), href: "/student/appointments", icon: CalendarDays },
    { label: t("nav.internships"), href: "/student/internships", icon: Briefcase },
    { label: t("nav.equipment"), href: "/student/equipment", icon: Package },
    { label: t("nav.procurement"), href: "/student/procurement", icon: ShoppingCart },
    { label: t("nav.events"), href: "/student/events", icon: PartyPopper },
    { label: t("nav.accessRequests"), href: "/student/access-requests", icon: ShieldCheck },
    { label: t("nav.calendar"), href: "/student/calendar", icon: Calendar },
    { label: t("nav.notifications"), href: "/student/notifications", icon: Bell },
    { label: t("nav.files"), href: "/student/files", icon: FolderOpen },
    { label: t("nav.settings"), href: "/student/settings", icon: Settings },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const storedUser = getStoredUser();
      if (!storedUser) {
        router.replace('/login');
        return;
      }

      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const token = getToken();

        const profile = await fetchProfile();
        setUser(profile);

        const notifRes = await fetch(`${backendUrl}/student/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (notifRes.ok) {
          const data = await notifRes.json();
          const notifications = Array.isArray(data)
            ? data
            : (data.notifications ?? []);
          setUnreadCount(notifications.filter((n: any) => !n.isRead).length);
        }
      } catch (error) {
        console.error("Layout fetch failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();

    const interval = setInterval(() => {
      void fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Session expired or profile fetch failed — show spinner instead of a blank
    // white screen while AuthGuard / AuthFetchProvider redirect to /login.
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const dynamicNavItems = navItems.map((item) =>
    item.href === "/student/notifications" ? { ...item, badge: unreadCount } : item,
  );

  const topbar = (
    <div className="flex items-center justify-between flex-1">
      <div className="hidden sm:block">
        <h1 className="text-sm font-semibold text-foreground">
          {t("nav.studentPortal")}
        </h1>
        <p className="text-xs text-muted-foreground">
          {user.department} · {user.studentId}
        </p>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationBell role="student" />
        <ProfileDropdown user={user} settingsHref="/student/settings" />
      </div>
    </div>
  );

  return (
    <AuthGuard allowedRoles={["STUDENT"]}>
      <PortalLayout
        navItems={dynamicNavItems}
        portalName={t("nav.studentPortal")}
        portalColor="indigo"
        topbar={topbar}
      >
        {children}
        <PortalAssistant
          portal="student"
          title={t("assistant.title")}
          description={t("assistant.description")}
          prompts={[
            t("assistant.internshipPrompt"),
            t("assistant.requestsPrompt"),
            t("assistant.reservationPrompt"),
          ]}
        />
      </PortalLayout>
    </AuthGuard>
  );
}

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudentI18nProvider>
      <RealtimeProvider>
        <NotificationToastProvider>
          <StudentLayoutInner>{children}</StudentLayoutInner>
        </NotificationToastProvider>
      </RealtimeProvider>
    </StudentI18nProvider>
  );
}
