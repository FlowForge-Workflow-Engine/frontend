/**
 * Date Formatting — Consistent date display across the app.
 */
import { format, formatDistanceToNow } from "date-fns";

/** Format a date string to "Mar 5, 2026 at 10:30 AM" */
export function formatDateTime(dateStr: string): string {
  return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
}

/** Format a date string to "Mar 5, 2026" */
export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "MMM d, yyyy");
}

/** Format a date string to relative time like "2 hours ago" */
export function formatRelative(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}
