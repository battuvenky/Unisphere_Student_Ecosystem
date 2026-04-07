"use client";

import Link from "next/link";
import type React from "react";

type QuickActionProps = {
  icon: React.ReactNode;
  label: string;
  href: string;
  variant?: "default" | "primary";
};

export function QuickAction({
  icon,
  label,
  href,
  variant = "default",
}: QuickActionProps) {
  const variantClasses = {
    default:
      "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--bg-muted)] dark:hover:bg-[var(--bg-muted)]",
    primary:
      "border-[var(--accent)]/60 bg-gradient-to-br from-[var(--accent)]/15 to-transparent hover:from-[var(--accent)]/25",
  };

  return (
    <Link href={href}>
      <div
        className={`group flex cursor-pointer flex-col items-center gap-3 rounded-xl border px-5 py-4 transition-all duration-300 hover:shadow-lg hover:shadow-gray-400/10 dark:hover:shadow-blue-900/20 ${variantClasses[variant]}`}
      >
        <div className="text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
          {icon}
        </div>
        <span className="text-center text-sm font-medium text-[var(--text-primary)]">
          {label}
        </span>
      </div>
    </Link>
  );
}

type QuickActionsProps = {
  actions: Array<{
    icon: React.ReactNode;
    label: string;
    href: string;
    priority?: "high" | "normal";
  }>;
};

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {actions.map((action) => (
          <QuickAction
            key={action.label}
            icon={action.icon}
            label={action.label}
            href={action.href}
            variant={action.priority === "high" ? "primary" : "default"}
          />
        ))}
      </div>
    </div>
  );
}
