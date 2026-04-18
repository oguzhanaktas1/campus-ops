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

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "My Requests", href: "/student/requests", icon: FileText },
  { label: "Documents", href: "/student/documents", icon: GraduationCap },
  { label: "Reservations", href: "/student/reservations", icon: Building2 },
  { label: "Appointments", href: "/student/appointments", icon: CalendarDays },
  { label: "Internships", href: "/student/internships", icon: Briefcase },
  { label: "Equipment", href: "/student/equipment", icon: Package },
  { label: "Procurement", href: "/student/procurement", icon: ShoppingCart },
  { label: "Events", href: "/student/events", icon: PartyPopper },
  { label: "Access Requests", href: "/student/access-requests", icon: ShieldCheck },
  { label: "Calendar", href: "/student/calendar", icon: Calendar },
  { label: "Notifications", href: "/student/notifications", icon: Bell },
  { label: "My Files", href: "/student/files", icon: FolderOpen },
  { label: "Settings", href: "/student/settings", icon: Settings },
];

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const storedUser = getStoredUser();
      if (!storedUser) {
        setIsLoading(false);
        router.push("/login");
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

  if (!user) return null;

  const dynamicNavItems = navItems.map((item) =>
    item.label === "Notifications" ? { ...item, badge: unreadCount } : item,
  );

  const topbar = (
    <div className="flex items-center justify-between flex-1">
      <div className="hidden sm:block">
        <h1 className="text-sm font-semibold text-foreground">
          Student Portal
        </h1>
        <p className="text-xs text-muted-foreground">
          {user.department} · {user.studentId}
        </p>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <ThemeToggle />
        <LanguageSwitcher />
        <NotificationBell role="student" />
        <ProfileDropdown user={user} settingsHref="/student/settings" />
      </div>
    </div>
  );

  return (
    <AuthGuard allowedRoles={["STUDENT"]}>
      <PortalLayout
        navItems={dynamicNavItems}
        portalName="Student Portal"
        portalColor="indigo"
        topbar={topbar}
      >
        {children}
        <PortalAssistant
          portal="student"
          title="Student AI Assistant"
          description="Route guidance, request status explanations, and next-step help within your own student scope."
          prompts={[
            "Staj başvurusu nasıl yapılır?",
            "Açık taleplerimi nasıl takip ederim?",
            "Rezervasyon için hangi sayfaya gitmeliyim?",
          ]}
        />
      </PortalLayout>
    </AuthGuard>
  );
}
