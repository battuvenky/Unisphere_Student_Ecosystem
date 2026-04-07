"use client";

import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 py-12 px-6 text-center">
      <div className="mb-4 rounded-full bg-[var(--bg-muted)] p-3">
        <Icon className="h-6 w-6 text-[var(--text-secondary)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
