/**
 * App.tsx — Root component with routing, providers, and layout.
 */
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { useAuthStore } from "@/stores/auth-store";

// Auth pages
import LoginPage from "@/pages/auth/LoginPage";
import RegisterTenantPage from "@/pages/auth/RegisterTenantPage";
import SelfRegisterPage from "@/pages/auth/SelfRegisterPage";

// Protected pages
import DashboardPage from "@/pages/DashboardPage";
import WorkflowsPage from "@/pages/WorkflowsPage";
import WorkflowDesignerPage from "@/pages/WorkflowDesignerPage";
import InstancesPage from "@/pages/InstancesPage";
import CreateInstancePage from "@/pages/CreateInstancePage";
import InstanceDetailPage from "@/pages/InstanceDetailPage";
import UsersPage from "@/pages/UsersPage";
import RolesPage from "@/pages/RolesPage";
import SettingsPage from "@/pages/SettingsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import WebhooksPage from "@/pages/WebhooksPage";
import NotFound from "@/pages/NotFound";

/** Root redirect based on auth state */
function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ThemeToggle />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterTenantPage />} />
            <Route path="/register/join" element={<SelfRegisterPage />} />

            {/* Protected routes with AppShell layout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/workflows" element={<WorkflowsPage />} />
                <Route path="/workflows/:id" element={<WorkflowDesignerPage />} />
                <Route path="/instances" element={<InstancesPage />} />
                <Route path="/instances/new" element={<CreateInstancePage />} />
                <Route path="/instances/:id" element={<InstanceDetailPage />} />

                {/* Admin-only routes */}
                <Route element={<AdminRoute />}>
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/roles" element={<RolesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/webhooks" element={<WebhooksPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
