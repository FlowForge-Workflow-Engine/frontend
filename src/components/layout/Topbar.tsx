/**
 * Topbar — Sticky header with page title and breadcrumbs.
 */
import { useLocation } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";

/** Map route paths to page titles */
const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/workflows": "Workflows",
  "/instances": "Instances",
  "/users": "Users",
  "/roles": "Roles",
  "/settings": "Settings",
  "/notifications": "Notifications",
  "/webhooks": "Webhooks",
};

export function Topbar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  // Find matching title
  const basePath = "/" + location.pathname.split("/")[1];
  const title = routeTitles[basePath] || "FlowForge";

  // Build breadcrumbs
  const segments = location.pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {segments.length > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-4">
            {segments.map((seg, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1">/</span>}
                <span className="capitalize">{seg.length > 8 ? seg.slice(0, 8) + "…" : seg}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={toggleTheme} className="md:hidden">
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </Button>
    </header>
  );
}
