"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; 
import { PortalLayout, type NavItem } from "@/components/portal-layout";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileDropdown } from "@/components/profile-dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
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

const baseNavItems: NavItem[] = [
  { label: "Dashboard",         href: "/faculty/dashboard",        icon: LayoutDashboard },
  // ── Student Requests (domain-first) ───────────────────────────
  { label: "Approvals",        href: "/faculty/approvals",        icon: CheckSquare },
  { label: "Internships",      href: "/faculty/internships",      icon: Briefcase },
  { label: "Appointments",     href: "/faculty/appointments",     icon: CalendarDays },
  { label: "Events",           href: "/faculty/events",           icon: PartyPopper },
  { label: "Documents",        href: "/faculty/documents",        icon: FileText },
  { label: "Equipment",        href: "/faculty/equipment",        icon: Package },
  { label: "Reservations",     href: "/faculty/reservations",     icon: MapPin },
  { label: "Procurement",      href: "/faculty/procurement",      icon: ShoppingCart },
  { label: "IT Tickets",       href: "/faculty/tickets",          icon: Ticket },
  { label: "Access Requests",  href: "/faculty/access-requests",  icon: ShieldCheck },
  // ── Personal ──────────────────────────────────────────────────
  { label: "My Calendar",       href: "/faculty/calendar",         icon: Calendar },
  { label: "Notifications",     href: "/faculty/notifications",    icon: Bell },
  { label: "Settings",          href: "/faculty/settings",         icon: Settings },
];

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0); // 🔥 YENİ
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter(); 

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return router.push("/login");

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        
        // Kullanıcı Profilini Çek
        const profileRes = await fetch(`${backendUrl}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!profileRes.ok) {
          localStorage.removeItem("access_token");
          return router.push("/login");
        }
        setUser(await profileRes.json());

        // 🔥 BİLDİRİMLERİ ÇEK (Sadece sayısını öğrenmek için) 🔥
        const notifRes = await fetch(`${backendUrl}/faculty/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (notifRes.ok) {
          const notifications = await notifRes.json();
          const unread = notifications.filter((n: any) => !n.isRead).length;
          setUnreadCount(unread);
        }
      } catch (error) {
        console.error("Layout Fetch Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
    // 🔥 Opsiyonel: Her 30 saniyede bir bildirim sayısını güncelle (Polling)
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);

  }, [router]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  // 🔥 NAV ITEMS'I DİNAMİK GÜNCELLE 🔥
  const dynamicNavItems = baseNavItems.map(item => {
    if (item.label === "Notifications") {
      return { ...item, badge: unreadCount };
    }
    return item;
  });

  const topbar = (
    <div className="flex items-center justify-between flex-1">
      <div className="hidden sm:block">
        <h1 className="text-sm font-semibold text-foreground">Faculty Portal</h1>
        <p className="text-xs text-muted-foreground">{user.title} · {user.department}</p>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <ThemeToggle />
        <NotificationBell role="faculty" />
        <ProfileDropdown user={user} settingsHref="/faculty/settings" />
      </div>
    </div>
  );

  return (
    <AuthGuard allowedRoles={["FACULTY"]}>
      <PortalLayout
        navItems={dynamicNavItems} // 🔥 BURASI DEĞİŞTİ
        portalName="Faculty Portal"
        portalColor="emerald"
        topbar={topbar}
      >
        {children}
      </PortalLayout>
    </AuthGuard>
  );
}