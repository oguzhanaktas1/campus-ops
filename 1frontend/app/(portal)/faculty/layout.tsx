"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalLayout, type NavItem } from "@/components/portal-layout";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Bell,
  Settings,
  Loader2,
  Briefcase,
  Calendar,
  PartyPopper,
  ShieldCheck,
  FileText,
  Package,
  Ticket,
  MapPin,
  ShoppingCart,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard/auth-guard";
import { PortalAssistant } from "@/components/ai/portal-assistant";
import { fetchProfile, getStoredUser, getToken } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/providers/realtime-provider";
import { FacultyI18nProvider } from "@/components/faculty/faculty-i18n-provider";
import { useI18n } from "@/lib/i18n";

function FacultyLayoutInner({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const storedUser = getStoredUser();
      if (!storedUser) {
        router.replace('/login');
        return;
      }

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const token = getToken();

        const profile = await fetchProfile();
        setUser(profile);

        const notifRes = await fetch(`${backendUrl}/faculty/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (notifRes.ok) {
          const notifications = await notifRes.json();
          const unread = notifications.filter((n: any) => !n.isRead).length;
          setUnreadCount(unread);
        }
      } catch (error) {
        console.error("Layout fetch failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const navItems: NavItem[] = [
    { label: t('nav.dashboard'), href: "/faculty/dashboard", icon: LayoutDashboard },
    {
      label: t('nav.approvals'), href: "/faculty/approvals", icon: CheckSquare,
      children: [
        { label: t('nav.approvals'), href: "/faculty/approvals" },
        { label: t('nav.requests'), href: "/faculty/requests" },
      ],
    },
    { label: t('nav.internships'), href: "/faculty/internships", icon: Briefcase },
    { label: t('nav.appointments'), href: "/faculty/appointments", icon: CalendarDays },
    { label: t('nav.events'), href: "/faculty/events", icon: PartyPopper },
    { label: t('nav.documents'), href: "/faculty/documents", icon: FileText },
    { label: t('nav.equipment'), href: "/faculty/equipment", icon: Package },
    { label: t('nav.reservations'), href: "/faculty/reservations", icon: MapPin },
    { label: t('nav.procurement'), href: "/faculty/procurement", icon: ShoppingCart },
    { label: t('nav.tickets'), href: "/faculty/tickets", icon: Ticket },
    { label: t('nav.accessRequests'), href: "/faculty/access-requests", icon: ShieldCheck },
    { label: t('nav.calendar'), href: "/faculty/calendar", icon: Calendar },
    { label: t('nav.notifications'), href: "/faculty/notifications", icon: Bell, badge: unreadCount },
    { label: t('nav.settings'), href: "/faculty/settings", icon: Settings },
  ];

  const topbar = (
    <div className="flex items-center justify-between flex-1">
      <div className="hidden sm:block">
        <h1 className="text-sm font-semibold text-foreground">{t('nav.facultyPortal')}</h1>
        <p className="text-xs text-muted-foreground">{user.title} · {user.department}</p>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationBell role="faculty" />
        <ProfileDropdown user={user} settingsHref="/faculty/settings" />
      </div>
    </div>
  );

  return (
    <AuthGuard allowedRoles={["FACULTY"]}>
      <PortalLayout
        navItems={navItems}
        portalName={t('nav.facultyPortal')}
        portalColor="emerald"
        topbar={topbar}
      >
        {children}
        <PortalAssistant
          portal="faculty"
          title={t('assistant.title')}
          description={t('assistant.description')}
          prompts={[
            t('assistant.approvalsPrompt'),
            t('assistant.internshipPrompt'),
            t('assistant.appointmentsPrompt'),
          ]}
        />
      </PortalLayout>
    </AuthGuard>
  );
}

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <FacultyI18nProvider>
      <RealtimeProvider>
        <FacultyLayoutInner>{children}</FacultyLayoutInner>
      </RealtimeProvider>
    </FacultyI18nProvider>
  );
}
