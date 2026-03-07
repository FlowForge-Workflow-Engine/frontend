/**
 * StatusBadge — Consistent status display across all pages.
 * Renders a colored pill badge for workflow/instance statuses.
 */
import { cn } from "@/lib/utils";

type Status = "active" | "completed" | "cancelled" | "draft" | "published" | "deprecated";

const statusStyles: Record<Status, string> = {
  active: "bg-status-active/15 text-status-active",
  completed: "bg-status-completed/15 text-status-completed",
  cancelled: "bg-muted text-muted-foreground",
  draft: "bg-status-draft/15 text-status-draft",
  published: "bg-status-published/15 text-status-published",
  deprecated: "bg-status-deprecated/15 text-status-deprecated",
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        statusStyles[status] || "bg-muted text-muted-foreground",
        className
      )}
    >
      {status}
    </span>
  );
}
