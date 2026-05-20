"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalLayout, type NavItem } from "@/components/portal-layout";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard,
  ClipboardList,
  Bell,
  Settings,
  Loader2,
  PartyPopper,
  BookMarked,
  ShieldCheck,
  ShoppingCart,
  Package,
} from "lucide-react";
import AuthGuard from "@/components/AuthGuard/auth-guard";
import { PortalAssistant } from "@/components/ai/portal-assistant";
import { fetchProfile, getStoredUser, getToken } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/providers/realtime-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { OrganizerI18nProvider } from "@/components/organizer/organizer-i18n-provider";
import { useI18n } from "@/lib/i18n";

const navItems: NavItem[] = [
  { label: "nav.dashboard", href: "/organizer/dashboard", icon: LayoutDashboard },
  { label: "nav.eventPlans", href: "/organizer/plans", icon: ClipboardList },
  { label: "nav.publishedEvents", href: "/organizer/events", icon: PartyPopper },
  { label: "nav.reservations", href: "/organizer/reservations", icon: BookMarked },
  { label: "nav.accessRequests", href: "/organizer/access-requests", icon: ShieldCheck },
  { label: "nav.procurement", href: "/organizer/procurement", icon: ShoppingCart },
  { label: "nav.equipment", href: "/organizer/equipment", icon: Package },
  { label: "nav.notifications", href: "/organizer/notifications", icon: Bell },
  { label: "nav.settings", href: "/organizer/settings", icon: Settings },
];

function OrganizerLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const [user, setUser] = useState<any>(null);
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
        const profile = await fetchProfile();
        setUser(profile);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    void fetchData();
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
      <div className="hidden sm:block">
        <h1 className="text-sm font-semibold text-foreground">
          {t('nav.organizerPortal')}
        </h1>
        <p className="text-xs text-muted-foreground">
          {user.department} · {user.staffId}
        </p>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationBell role="organizer" />
        <ProfileDropdown user={user} settingsHref="/organizer/settings" />
      </div>
    </div>
  );

  const translatedNavItems = navItems.map((item) => ({ ...item, label: t(item.label) }));

  return (
    <AuthGuard allowedRoles={["ORGANIZER", "ADMIN"]}>
      <PortalLayout
        navItems={translatedNavItems}
        portalName={t('nav.organizerPortal')}
        portalColor="purple"
        topbar={topbar}
      >
        {children}
        <PortalAssistant
          portal="organizer"
          title={t('assistant.title')}
          description={t('assistant.description')}
          prompts={[
            t('assistant.planPrompt'),
            t('assistant.reservationPrompt'),
            t('assistant.equipmentPrompt'),
          ]}
        />
      </PortalLayout>
    </AuthGuard>
  );
}

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrganizerI18nProvider>
      <RealtimeProvider>
        <OrganizerLayoutInner>{children}</OrganizerLayoutInner>
      </RealtimeProvider>
    </OrganizerI18nProvider>
  );
}
