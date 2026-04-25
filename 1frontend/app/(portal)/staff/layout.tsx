"use client";

import { useEffect, useState } from "react";
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

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/staff/dashboard", icon: LayoutDashboard },
  { label: "Inbox", href: "/staff/requests", icon: Inbox },
  { label: "IT Tickets", href: "/staff/tickets", icon: Ticket },
  { label: "Equipment", href: "/staff/equipment", icon: Package },
  { label: "Reservations", href: "/staff/reservations", icon: BookMarked },
  { label: "Documents", href: "/staff/documents", icon: Files },
  { label: "Procurement", href: "/staff/procurement", icon: ShoppingCart },
  { label: "Events", href: "/staff/events", icon: PartyPopper },
  { label: "Internships", href: "/staff/internships", icon: Briefcase },
  { label: "Appointments", href: "/staff/appointments", icon: CalendarDays },
  { label: "Access Requests", href: "/staff/access-requests", icon: ShieldCheck },
  { label: "Reports", href: "/staff/reports", icon: BarChart3 },
  { label: "Calendar", href: "/staff/calendar", icon: Calendar },
  { label: "Notifications", href: "/staff/notifications", icon: Bell },
  { label: "Settings", href: "/staff/settings", icon: Settings },
];

export default function StaffLayout({
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
        const data = await fetchProfile();
        setUser(data);
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
      <div className="hidden sm:block">
        <h1 className="text-sm font-semibold text-foreground">Staff Portal</h1>
        <p className="text-xs text-muted-foreground">
          {user.title} · {user.department}
        </p>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <ThemeToggle />
        <LanguageSwitcher />
        <NotificationBell role="staff" />
        <ProfileDropdown user={user} settingsHref="/staff/settings" />
      </div>
    </div>
  );

  return (
    <AuthGuard allowedRoles={["STAFF"]}>
      <PortalLayout
        navItems={navItems}
        portalName="Staff Portal"
        portalColor="amber"
        topbar={topbar}
      >
        {children}
        <PortalAssistant
          portal="staff"
          title="Staff AI Assistant"
          description="Queue navigation, ticket guidance, and role-aware help for staff operations."
          prompts={[
            "Açık ticketları nereden görebilirim?",
            "Onay kuyruğuma nasıl giderim?",
            "Doküman işlemleri için hangi sayfa uygun?",
          ]}
        />
      </PortalLayout>
    </AuthGuard>
  );
}
