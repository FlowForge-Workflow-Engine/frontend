/**
 * CopyableId — Shows truncated UUID with copy-to-clipboard functionality.
 */
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyableIdProps {
  id: string;
  className?: string;
}

export function CopyableId({ id, className }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-mono",
        "bg-muted text-muted-foreground hover:bg-accent transition-colors",
        className
      )}
      title={id}
    >
      {id.slice(0, 8)}…
      {copied ? (
        <Check className="h-3 w-3 text-status-active" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}
