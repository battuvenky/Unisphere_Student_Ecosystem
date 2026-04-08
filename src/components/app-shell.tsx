"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Building2,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileText,
  Handshake,
  LayoutGrid,
  MessageSquareMore,
  Menu,
  Search,
  UserRound,
  Users,
  BookOpenText,
  Wallet,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import type { SessionUser } from "@/lib/auth/types";
import { getRealtimeSocket } from "@/lib/realtime-client";

const AUTH_TOKEN_STORAGE_KEY = "unisphere_auth_token";

type AppShellProps = {
  children: React.ReactNode;
  user: SessionUser;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Resources", href: "/resources", icon: BookOpenText },
  { label: "Doubts", href: "/doubts", icon: CircleHelp },
  { label: "Placement", href: "/placement", icon: Briefcase },
  { label: "Tasks", href: "/tasks", icon: ClipboardList },
  { label: "Expenses", href: "/expenses", icon: Wallet },
  { label: "Scheduler", href: "/scheduler", icon: CalendarClock },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Groups", href: "/groups", icon: Users },
  { label: "Connections", href: "/connections", icon: MessageSquareMore },
  { label: "Mentorship", href: "/mentorship", icon: Handshake },
  { label: "Campus", href: "/campus", icon: Building2 },
  { label: "Notes", href: "/notes", icon: FileText },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: UserRound },
];

const adminNavItems: NavItem[] = [
  { label: "Admin Dashboard", href: "/admin", icon: LayoutGrid },
  { label: "Resources", href: "/resources", icon: BookOpenText },
  { label: "Doubts", href: "/doubts", icon: CircleHelp },
  { label: "Connections", href: "/connections", icon: MessageSquareMore },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: UserRound },
];

export function AppShell({ children, user }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) {
      return;
    }

    const join = () => {
      socket.emit("user:join", { userId: user.id });
    };

    join();
    socket.on("connect", join);

    return () => {
      socket.off("connect", join);
    };
  }, [user.id]);

  const initials = user.profile.fullName
    .split(" ")
    .map((name) => name.slice(0, 1).toUpperCase())
    .join("")
    .slice(0, 2);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      router.push("/login");
      router.refresh();
    }
  };

  const visibleNavItems = user.role === "admin" ? adminNavItems : navItems;

  return (
    <div className="relative min-h-screen bg-app-gradient text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(21,101,192,0.15),transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(0,188,212,0.16),transparent_40%)]" />

      <div className="relative flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-30 flex border-r border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-lg transition-all duration-300 md:sticky ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } w-[86vw] max-w-[320px] md:max-w-none ${isCollapsed ? "md:w-[88px]" : "md:w-[260px]"}`}
        >
          <div className="flex w-full flex-col p-4">
            <div className="mb-6 flex items-center justify-between">
              <div className={`overflow-hidden transition-all duration-200 ${isCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">UniSphere</p>
                <p className="text-lg font-bold tracking-tight">Student Life Ecosystem</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="hidden h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] shadow-sm transition-all duration-200 hover:shadow md:inline-flex"
                aria-label="Toggle sidebar"
              >
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>

            <nav className="space-y-2">
              {visibleNavItems.map((item) => {
                const isActive = pathname === item.href;
                const ItemIcon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-[var(--accent)] text-white shadow-md"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <ItemIcon size={18} className={isActive ? "text-white" : ""} />
                    <span className={`whitespace-nowrap transition-all duration-200 ${isCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className={`mt-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 ${isCollapsed ? "md:text-center" : ""}`}>
              <p className={`text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)] ${isCollapsed ? "md:hidden" : ""}`}>Signed in as</p>
              <p className={`font-semibold text-[var(--text-primary)] ${isCollapsed ? "md:hidden" : ""}`}>{user.profile.fullName}</p>
              <p className={`text-xs text-[var(--text-secondary)] ${isCollapsed ? "md:hidden" : ""}`}>{user.role === "admin" ? "Admin" : "Student"}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-colors hover:bg-[var(--card)] disabled:opacity-70"
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col md:pl-0">
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/85 px-4 py-3 backdrop-blur-lg md:px-6 lg:px-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm md:hidden"
                aria-label="Toggle mobile menu"
              >
                <Menu size={18} />
              </button>

              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                />
                <input
                  type="search"
                  placeholder="Search UniSphere..."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 pl-9 pr-3 text-sm outline-none transition-all duration-200 placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_20%,transparent)]"
                />
              </div>

              <ThemeToggle />

              <NotificationDropdown />

              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 text-[var(--text-primary)] shadow-sm transition-all duration-200 hover:scale-[1.03] hover:shadow-md"
                aria-label="Open profile"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                  {initials || <UserRound size={14} />}
                </span>
                <span className="hidden text-xs font-semibold text-[var(--text-secondary)] sm:inline-block">
                  {user.role === "admin" ? "Admin" : "Student"}
                </span>
              </button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="layout-content">{children}</div>
          </main>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-[1px] md:hidden"
          aria-label="Close mobile menu"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      ) : null}
    </div>
  );
}
