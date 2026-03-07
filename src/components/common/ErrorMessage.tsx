/**
 * ErrorMessage — Parses API error responses and shows user-friendly text.
 */
import { AlertCircle } from "lucide-react";
import { getErrorMessage } from "@/utils/error-messages";

interface ErrorMessageProps {
  error: unknown;
  className?: string;
}

export function ErrorMessage({ error, className }: ErrorMessageProps) {
  const message = getErrorMessage(error);

  return (
    <div className={`flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive ${className ?? ""}`}>
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
