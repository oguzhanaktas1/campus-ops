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
  Ticket,
  Files,
  Bell,
  Settings,
  Loader2,
  BookMarked,
  BarChart3,
  Calendar,
  Package,
  ShieldCheck,
  PartyPopper,
  ShoppingCart,
  Inbox,
  Briefcase,
  CalendarDays,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard/auth-guard";
import { PortalAssistant } from "@/components/ai/portal-assistant";
import { fetchProfile, getStoredUser } from "@/lib/auth";
import { StaffI18nProvider } from "@/components/staff/staff-i18n-provider";
import { useI18n } from "@/lib/i18n";

function StaffLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchUserProfile = async () => {
      const storedUser = getStoredUser();
      if (!storedUser) {
        router.replace('/login');
        return;
      }

      try {
        const data = await fetchProfile();
        setUser(data);
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

  const navItems: NavItem[] = [
    { label: t('nav.dashboard'), href: "/staff/dashboard", icon: LayoutDashboard },
    { label: t('nav.inbox'), href: "/staff/requests", icon: Inbox },
    { label: t('nav.tickets'), href: "/staff/tickets", icon: Ticket },
    { label: t('nav.equipment'), href: "/staff/equipment", icon: Package },
    { label: t('nav.reservations'), href: "/staff/reservations", icon: BookMarked },
    { label: t('nav.documents'), href: "/staff/documents", icon: Files },
    { label: t('nav.procurement'), href: "/staff/procurement", icon: ShoppingCart },
    { label: t('nav.events'), href: "/staff/events", icon: PartyPopper },
    { label: t('nav.internships'), href: "/staff/internships", icon: Briefcase },
    { label: t('nav.appointments'), href: "/staff/appointments", icon: CalendarDays },
    { label: t('nav.accessRequests'), href: "/staff/access-requests", icon: ShieldCheck },
    { label: t('nav.reports'), href: "/staff/reports", icon: BarChart3 },
    { label: t('nav.calendar'), href: "/staff/calendar", icon: Calendar },
    { label: t('nav.notifications'), href: "/staff/notifications", icon: Bell },
    { label: t('nav.settings'), href: "/staff/settings", icon: Settings },
  ];

  const topbar = (
    <div className="flex items-center justify-between flex-1">
      <div className="hidden sm:block">
        <h1 className="text-sm font-semibold text-foreground">{t('nav.staffPortal')}</h1>
        <p className="text-xs text-muted-foreground">
          {user.title} · {user.department}
        </p>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationBell role="staff" />
        <ProfileDropdown user={user} settingsHref="/staff/settings" />
      </div>
    </div>
  );

  return (
    <AuthGuard allowedRoles={["STAFF"]}>
      <PortalLayout
        navItems={navItems}
        portalName={t('nav.staffPortal')}
        portalColor="amber"
        topbar={topbar}
      >
        {children}
        <PortalAssistant
          portal="staff"
          title={t('assistant.title')}
          description={t('assistant.description')}
          prompts={[
            t('assistant.openTicketsPrompt'),
            t('assistant.approvalsPrompt'),
            t('assistant.documentsPrompt'),
          ]}
        />
      </PortalLayout>
    </AuthGuard>
  );
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffI18nProvider>
      <StaffLayoutInner>{children}</StaffLayoutInner>
    </StaffI18nProvider>
  );
}
