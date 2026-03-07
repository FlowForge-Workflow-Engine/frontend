/**
 * AppShell — Main layout wrapper for authenticated pages.
 * Renders sidebar + topbar + main content area.
 */
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  return (
    <div className="flex min-h-screen transition-colors duration-200">
      <Sidebar />
      <div className="flex flex-1 flex-col pl-60">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
