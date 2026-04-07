"use client";

import { formatDistanceToNow } from "date-fns";

type ActivityItem = {
  id: string;
  type: "task" | "resource" | "doubt" | "achievement";
  title: string;
  description: string;
  timestamp: string;
  icon: string;
};

type ActivityFeedProps = {
  activities: ActivityItem[];
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const getTypeColor = (
    type: "task" | "resource" | "doubt" | "achievement"
  ) => {
    const colors = {
      task: "bg-blue-500/15 border-blue-400/40",
      resource: "bg-purple-500/15 border-purple-400/40",
      doubt: "bg-amber-500/15 border-amber-400/40",
      achievement: "bg-emerald-500/15 border-emerald-400/40",
    };
    return colors[type];
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
        Recent Activity
      </h3>
      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`group flex gap-3 rounded-lg border px-4 py-3 transition-all duration-300 hover:shadow-md hover:shadow-gray-400/5 dark:hover:shadow-white/5 ${getTypeColor(activity.type)}`}
          >
            <div className="mt-0.5 flex-shrink-0 text-xl">{activity.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors duration-200">
                {activity.title}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {activity.description}
              </p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {formatDistanceToNow(new Date(activity.timestamp), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
