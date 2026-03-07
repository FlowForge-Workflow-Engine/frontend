/**
 * AdminRoute — Redirects to /dashboard if user is not an Admin.
 */
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function AdminRoute() {
  const user = useAuthStore((s) => s.user);

  if (!user?.roles.includes("Admin")) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
