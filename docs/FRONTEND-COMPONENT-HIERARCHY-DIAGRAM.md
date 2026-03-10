> _Type:_ Frontend Component Hierarchy Diagram  
> _Description:_ Shows the React component tree from `App.tsx` through `AppShell` to page components, with Zustand stores and TanStack Query cache shown as data providers.

### High-Level Hierarchy

![Component Diagram](./images/component-diagram.png)

```text
App (frontend/src/App.tsx)
├─ QueryClientProvider (TanStack Query)
│  └─ queryClient (frontend/src/lib/query-client.ts)
├─ ThemeProvider (frontend/src/components/ThemeProvider.tsx)
├─ TooltipProvider (frontend/src/components/ui/tooltip.tsx)
├─ Toaster (frontend/src/components/ui/toaster.tsx)
├─ Sonner (frontend/src/components/ui/sonner.tsx)
├─ ThemeToggle (frontend/src/components/common/ThemeToggle.tsx)
└─ BrowserRouter
   └─ Routes
      ├─ Public routes
      │  ├─ "/" → RootRedirect (uses `useAuthStore` from frontend/src/stores/auth-store.ts)
      │  ├─ "/login" → LoginPage
      │  ├─ "/register" → RegisterTenantPage
      │  └─ "/register/join" → SelfRegisterPage
      ├─ ProtectedRoute (frontend/src/components/auth/ProtectedRoute.tsx)
      │  └─ AppShell (frontend/src/components/layout/AppShell.tsx)
      │     ├─ Sidebar (frontend/src/components/layout/Sidebar.tsx)
      │     └─ Topbar (frontend/src/components/layout/Topbar.tsx)
      │        └─ Outlet (page content)
      │           ├─ "/dashboard" → DashboardPage
      │           ├─ "/workflows" → WorkflowsPage
      │           ├─ "/workflows/:id" → WorkflowDesignerPage
      │           ├─ "/instances" → InstancesPage
      │           ├─ "/instances/new" → CreateInstancePage
      │           ├─ "/instances/:id" → InstanceDetailPage
      │           └─ AdminRoute (frontend/src/components/auth/AdminRoute.tsx)
      │              ├─ "/users" → UsersPage
      │              ├─ "/roles" → RolesPage
      │              ├─ "/settings" → SettingsPage
      │              ├─ "/settings/pricing" → PricingPage
      │              ├─ "/notifications" → NotificationsPage
      │              └─ "/webhooks" → WebhooksPage
      └─ "*" → NotFound
```

### Data Providers & State

| Layer / Provider                       | Scope                   | Notes                                                                                              |
| -------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| `QueryClientProvider`                  | Wraps entire `App`      | TanStack Query cache for all server state queries/mutations                                        |
| `useAuthStore` (Zustand)               | Global store            | Authentication/session state used by `RootRedirect`, `ProtectedRoute`, `AdminRoute`, and header UI |
| `workflow-designer-store` (Zustand)    | Workflow designer pages | Local UI + draft state for workflow design, independent from auth state                            |
| `ThemeProvider`                        | Global                  | Manages light/dark theme and exposes context to `AppShell`, pages, and components                  |
| `TooltipProvider`, `Toaster`, `Sonner` | Global UI infra         | Cross-cutting UX components available to all pages                                                 |
