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

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/organizer/dashboard", icon: LayoutDashboard },
  { label: "Event Plans", href: "/organizer/plans", icon: ClipboardList },
  { label: "Published Events", href: "/organizer/events", icon: PartyPopper },
  { label: "Reservations", href: "/organizer/reservations", icon: BookMarked },
  { label: "Access Requests", href: "/organizer/access-requests", icon: ShieldCheck },
  { label: "Procurement", href: "/organizer/procurement", icon: ShoppingCart },
  { label: "Equipment", href: "/organizer/equipment", icon: Package },
  { label: "Notifications", href: "/organizer/notifications", icon: Bell },
  { label: "Settings", href: "/organizer/settings", icon: Settings },
];

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          Organizer Portal
        </h1>
        <p className="text-xs text-muted-foreground">
          {user.department} · {user.staffId}
        </p>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <ThemeToggle />
        <NotificationBell role="organizer" />
        <ProfileDropdown user={user} settingsHref="/organizer/settings" />
      </div>
    </div>
  );

  return (
    <AuthGuard allowedRoles={["ORGANIZER", "ADMIN"]}>
      <PortalLayout
        navItems={navItems}
        portalName="Organizer Portal"
        portalColor="purple"
        topbar={topbar}
      >
        {children}
        <PortalAssistant
          portal="organizer"
          title="Organizer AI Assistant"
          description="Event, reservation, equipment, and access-request guidance within organizer routes."
          prompts={[
            "Where do I create a new event plan?",
            "Can you explain the reservation process?",
            "Which page should I go to for an equipment request?",
          ]}
        />
      </PortalLayout>
    </AuthGuard>
  );
}
