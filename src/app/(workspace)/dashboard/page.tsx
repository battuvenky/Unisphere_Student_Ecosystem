import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { findUserById, toSessionUser } from "@/lib/users-store";
import { listAnnouncements } from "@/lib/announcements-store";
import { StatCard } from "@/components/stat-card";
import { QuickActions } from "@/components/quick-actions";
import { ActivityFeed } from "@/components/activity-feed";
import {
  ClipboardList,
  BookOpenText,
  CircleHelp,
  Target,
  Zap,
  TrendingUp,
} from "lucide-react";

type DashboardPageProps = {
  searchParams: Promise<{ denied?: string }>;
};

type DashboardData = {
  stats: {
    tasksCompleted: number;
    tasksTotal: number;
    dsaProgress: number;
    resourcesAccessed: number;
  };
  userSummary: {
    fullName: string;
    role: "student" | "admin";
    department: string;
    year: string;
    specialization: string;
    headline: string;
  };
  suggestions: string[];
  recentActivity: Array<{
    id: string;
    type: "task" | "resource" | "doubt" | "achievement";
    title: string;
    description: string;
    timestamp: string;
    icon: string;
  }>;
};

async function getDashboardData(): Promise<DashboardData | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const payload = await verifySessionToken(token);
    const user = await findUserById(payload.sub);

    if (!user) {
      return null;
    }

    // Generate dummy data based on user profile hash for consistency
    const userHash = user.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

    const stats: DashboardData = {
      stats: {
        tasksCompleted: 12 + (userHash % 18),
        tasksTotal: 28 + (userHash % 12),
        dsaProgress: 45 + (userHash % 35),
        resourcesAccessed: 23 + (userHash % 27),
      },
      userSummary: {
        fullName: user.profile.fullName,
        role: user.role,
        department: user.profile.department,
        year: user.profile.year,
        specialization: user.profile.specialization ?? "General",
        headline:
          user.profile.headline ||
          (user.role === "admin"
            ? "Driving student outcomes through data and campus programs."
            : "Learning consistently and building practical skills every week."),
      },
      suggestions: user.role === "admin"
        ? [
            "Review blocked-user list and resolve pending appeals.",
            "Publish one weekly announcement for upcoming campus deadlines.",
            "Monitor doubt-response SLA for unanswered questions.",
          ]
        : [
            "Complete one high-priority task before noon.",
            "Revise one DSA topic and solve 2 timed problems.",
            "Share one useful resource with your study group.",
          ],
      recentActivity: [
        {
          id: "1",
          type: "task",
          title: "Array Fundamentals Quiz",
          description: "Completed the DSA fundamentals quiz with 92% score",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          icon: "✓",
        },
        {
          id: "2",
          type: "resource",
          title: "DBMS Notes Download",
          description: "Downloaded comprehensive DBMS notes (18 pages)",
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          icon: "📚",
        },
        {
          id: "3",
          type: "doubt",
          title: "Recursion Doubt Resolved",
          description: "Your doubt on recursion patterns was answered",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          icon: "💡",
        },
        {
          id: "4",
          type: "achievement",
          title: "7-Day Streak",
          description: "You have completed tasks for 7 consecutive days",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          icon: "🔥",
        },
        {
          id: "5",
          type: "resource",
          title: "React 19 Basics",
          description: "New course material added to your learning path",
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          icon: "⚡",
        },
      ],
    };

    return stats;
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return null;
  }
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const query = await searchParams;
  const dashboardData = await getDashboardData();
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (token) {
    const payload = await verifySessionToken(token);
    const user = await findUserById(payload.sub);
    if (user?.role === "admin") {
      redirect("/admin");
    }
  }

  const announcements = (await listAnnouncements()).slice(0, 3);

  const stats = dashboardData?.stats || {
    tasksCompleted: 0,
    tasksTotal: 0,
    dsaProgress: 0,
    resourcesAccessed: 0,
  };

  const activities = dashboardData?.recentActivity || [];
  const summary = dashboardData?.userSummary ?? {
    fullName: "Student",
    role: "student" as const,
    department: "Department",
    year: "Year",
    specialization: "General",
    headline: "Build momentum with consistent daily learning.",
  };
  const suggestions = dashboardData?.suggestions ?? [
    "Plan your next study session.",
    "Review pending modules.",
    "Capture quick notes from today.",
  ];
  const recentHighlights = activities.slice(0, 3);

  const taskProgress =
    stats.tasksTotal > 0
      ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100)
      : 0;

  const quickActions = [
    {
      icon: "📝",
      label: "New Task",
      href: "/tasks",
      priority: "high" as const,
    },
    {
      icon: "🔍",
      label: "Ask Doubt",
      href: "/doubts",
      priority: "high" as const,
    },
    { icon: "📚", label: "Resources", href: "/resources", priority: "normal" as const },
    { icon: "🎯", label: "Placement", href: "/placement", priority: "normal" as const },
    { icon: "👤", label: "Profile", href: "/profile", priority: "normal" as const },
    { icon: "⚙️", label: "Settings", href: "/profile", priority: "normal" as const },
  ];

  return (
    <div className="page-enter space-y-6">
      {query.denied ? (
        <div className="rounded-2xl border border-amber-500/45 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Access to this section is restricted for your current role.
        </div>
      ) : null}

      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          Welcome back!
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Here's your academic progress at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tasks Completed"
          value={`${stats.tasksCompleted}/${stats.tasksTotal}`}
          icon="✓"
          variant="success"
          trend={{ value: 12, direction: "up" }}
          subtitle={`${taskProgress}% complete`}
        />
        <StatCard
          label="DSA Progress"
          value={`${stats.dsaProgress}%`}
          icon="🎯"
          variant="accent"
          trend={{ value: 8, direction: "up" }}
          subtitle="Topics mastered"
        />
        <StatCard
          label="Resources"
          value={stats.resourcesAccessed}
          icon="📚"
          variant="default"
          trend={{ value: 5, direction: "up" }}
          subtitle="Downloaded this month"
        />
        <StatCard
          label="Streak"
          value="7"
          icon="🔥"
          variant="default"
          subtitle="days in a row"
        />
      </div>

      <QuickActions actions={quickActions} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityFeed activities={activities} />

          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Latest Announcements</h3>
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Campus</span>
            </div>
            <div className="space-y-3">
              {announcements.length > 0 ? announcements.map((announcement) => (
                <article key={announcement.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2.5">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{announcement.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{announcement.message}</p>
                </article>
              )) : (
                <p className="text-xs text-[var(--text-secondary)]">No announcements posted yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent)]/15 to-transparent p-5">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Tip of the Day
                </h3>
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  Study in focused 25-minute intervals with 5-minute breaks. This
                  Pomodoro technique can boost your productivity by up to 40%.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Upcoming Deadlines
            </h3>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-xs">
                <span className="font-medium text-[var(--text-primary)]">
                  Recursion Assignment
                </span>
                <span className="text-amber-600 dark:text-amber-400">
                  2 days
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-xs">
                <span className="font-medium text-[var(--text-primary)]">
                  Mock Interview
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  5 days
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-12">
        <article className="card-hover rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 xl:col-span-7">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Profile Summary</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-[1.6fr_1fr]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-4">
              <p className="text-base font-semibold text-[var(--text-primary)]">{summary.fullName}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{summary.headline}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[var(--text-secondary)]">{summary.department}</span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[var(--text-secondary)]">{summary.year}</span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[var(--text-secondary)]">{summary.specialization}</span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 uppercase text-[var(--text-secondary)]">{summary.role}</span>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Recent Highlights</h3>
              <div className="mt-3 space-y-2">
                {recentHighlights.length > 0 ? recentHighlights.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                    <p className="text-xs font-medium text-[var(--text-primary)]">{item.title}</p>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{item.description}</p>
                  </div>
                )) : (
                  <p className="text-xs text-[var(--text-secondary)]">No highlights yet.</p>
                )}
              </div>
            </div>
          </div>
        </article>

        <div className="space-y-4 xl:col-span-5">
          <article className="card-hover rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Suggestions & Insights</h2>
            <ul className="mt-3 space-y-2">
              {suggestions.map((item) => (
                <li key={item} className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="card-hover rounded-2xl border border-[var(--border)] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--card)_85%,#ffffff_15%)_0%,color-mix(in_srgb,var(--bg-muted)_88%,#90caf9_12%)_100%)] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">About Developer</h2>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              UniSphere is crafted to make student life simpler with connected tools for learning, collaboration, and growth.
              The focus is a fast, friendly, and reliable campus experience with practical features built for everyday use.
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Design goal: informative, minimal, and human-centered.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
