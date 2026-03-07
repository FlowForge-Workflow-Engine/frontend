/**
 * DashboardPage — Overview with stat cards, recent instances, and quick actions.
 */
import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { unwrap, unwrapList } from "@/lib/api-helpers";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CopyableId } from "@/components/common/CopyableId";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GitBranch, Play, Users, CheckCircle, Plus, Rocket } from "lucide-react";
import { formatDate } from "@/utils/format-date";
import type { WorkflowDefinition, WorkflowInstance } from "@/types/api";

interface DashboardStats {
  totalWorkflows: number;
  publishedWorkflows: number;
  activeInstances: number;
  totalUsers: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => apiClient.get("/api/v1/dashboard/stats").then((res) => unwrap<DashboardStats>(res)),
  });

  const { data: recentWorkflowData, isLoading: recentWorkflowsLoading } = useQuery({
    queryKey: queryKeys.workflowDefinitions.list({ page: 1, limit: 10 }),
    queryFn: () => apiClient.get("/api/v1/workflow-definitions?page=1&limit=10"), // show last 10 workflows
    select: (res) => unwrapList<WorkflowDefinition>(res),
  });

  // Fetch recent instances
  const { data: recentData, isLoading: recentInstancesLoading } = useQuery({
    queryKey: queryKeys.workflowInstances.list({ page: 1, limit: 10 }),
    queryFn: () => apiClient.get("/api/v1/workflow-instances?page=1&limit=10"), // show last 10 instances
    select: (res) => unwrapList<WorkflowInstance>(res),
  });

  const recentInstances = recentData?.items ?? [];

  const workflowDefinitionIds = useMemo(
    () => Array.from(new Set(recentInstances.map((instance) => instance.workflowDefinitionId))),
    [recentInstances],
  );

  const workflowDefinitionQueries = useQueries({
    queries: workflowDefinitionIds.map((id) => ({
      queryKey: queryKeys.workflowDefinitions.detail(id),
      queryFn: () =>
        apiClient.get(`/api/v1/workflow-definitions/${id}`).then((res) => unwrap<WorkflowDefinition>(res)),
      staleTime: 1000 * 60 * 10,
    })),
  });

  const workflowNameById = useMemo(
    () =>
      Object.fromEntries(
        workflowDefinitionQueries
          .map((query) => query.data)
          .filter((def): def is WorkflowDefinition => Boolean(def))
          .map((def) => [def.id, def.name]),
      ),
    [workflowDefinitionQueries],
  );

  if (statsLoading || recentWorkflowsLoading || recentInstancesLoading) {
    return <LoadingSpinner />;
  }

  const recentDefs = recentWorkflowData?.items ?? [];

  const stats = [
    {
      label: "Total Workflows",
      value: dashboardStats?.totalWorkflows ?? 0,
      icon: GitBranch,
      color: "text-primary",
    },
    {
      label: "Active Instances",
      value: dashboardStats?.activeInstances ?? 0,
      icon: Play,
      color: "text-status-active",
    },
    {
      label: "Total Users",
      value: dashboardStats?.totalUsers ?? 0,
      icon: Users,
      color: "text-status-completed",
    },
    {
      label: "Published Workflows",
      value: dashboardStats?.publishedWorkflows ?? 0,
      icon: CheckCircle,
      color: "text-status-published",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your FlowForge workspace at a glance"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => navigate("/workflows/new")} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Workflow
            </Button>
            <Button onClick={() => navigate("/instances/new")} size="sm">
              <Rocket className="h-4 w-4 mr-1" /> New Instance
            </Button>
          </div>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Instances */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Instances</CardTitle>
          </CardHeader>
          <CardContent>
            {recentInstances.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No instances yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInstances.map((inst) => (
                    <TableRow
                      key={inst.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/instances/${inst.id}`)}
                    >
                      <TableCell>
                        <CopyableId id={inst.id} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {workflowNameById[inst.workflowDefinitionId] ?? "Unknown workflow"}
                      </TableCell>
                      <TableCell className="font-medium">{inst.currentStateName}</TableCell>
                      <TableCell>
                        <StatusBadge status={inst.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(inst.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Your Workflows */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Workflows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentDefs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No workflows yet.</p>
            ) : (
              recentDefs.map((def) => (
                <div
                  key={def.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => navigate(`/workflows/${def.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium">{def.name}</p>
                    <p className="text-xs text-muted-foreground">v{def.currentVersion}</p>
                  </div>
                  <StatusBadge status={def.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
