/**
 * Sidebar — Fixed left navigation with links, user info, and theme toggle.
 */
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  Play,
  Users,
  Shield,
  Settings,
  Bell,
  Webhook,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

/** Navigation items for the sidebar */
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Workflows", icon: GitBranch, path: "/workflows" },
  { label: "Instances", icon: Play, path: "/instances" },
];

const adminNavItems = [
  { label: "Users", icon: Users, path: "/users" },
  { label: "Roles", icon: Shield, path: "/roles" },
  { label: "Settings", icon: Settings, path: "/settings" },
  { label: "Notifications", icon: Bell, path: "/notifications" },
  { label: "Webhooks", icon: Webhook, path: "/webhooks" },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = user?.roles.includes("Admin");

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo + Tenant */}
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          FF
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">FlowForge</span>
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
            {user?.tenantSlug || "—"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.path)
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Admin
              </span>
            </div>
            {adminNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.path)
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Bottom — User + Theme */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </button>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              {user?.firstName?.charAt(0) || "?"}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium truncate max-w-[100px]">
                {user?.firstName || "User"}
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                {user?.email || ""}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1 rounded-md hover:bg-sidebar-accent transition-colors"
            title="Log out"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  );
}
