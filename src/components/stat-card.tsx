"use client";

import type React from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; direction: "up" | "down" };
  variant?: "default" | "accent" | "success";
};

export function StatCard({
  label,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
}: StatCardProps) {
  const variantClasses = {
    default: "border-[var(--border)] bg-[var(--card)]",
    accent: "border-blue-400/50 bg-gradient-to-br from-blue-500/10 to-transparent",
    success: "border-emerald-400/50 bg-gradient-to-br from-emerald-500/10 to-transparent",
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border p-5 transition-all duration-300 hover:shadow-lg hover:shadow-gray-400/10 dark:hover:shadow-blue-900/20 ${variantClasses[variant]}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-transparent to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-white/5 dark:to-white/0" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--text-secondary)] transition-colors duration-300 group-hover:text-[var(--accent)]">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-[var(--text-primary)]">
              {value}
            </span>
            {trend && (
              <span
                className={`text-xs font-medium ${
                  trend.direction === "up"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {trend.direction === "up" ? "↑" : "↓"} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-2xl transition-transform duration-300 group-hover:scale-110">
            {icon}
          </div>
        )}
      </div>

      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100 dark:via-blue-500/20" />
    </div>
  );
}
