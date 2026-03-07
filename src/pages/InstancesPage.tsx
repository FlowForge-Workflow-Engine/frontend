/**
 * InstancesPage — List workflow instances with filters and pagination.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CopyableId } from "@/components/common/CopyableId";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Play } from "lucide-react";
import { formatDate } from "@/utils/format-date";
import type { ColumnDef } from "@tanstack/react-table";
import type { WorkflowInstance } from "@/types/api";

export default function InstancesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const limit = 20;

  const queryParams = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (statusFilter !== "all") queryParams.set("status", statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.workflowInstances.list({ page, limit, status: statusFilter }),
    queryFn: () => apiClient.get(`/api/v1/workflow-instances?${queryParams}`),
    select: (res) => ({ items: res.data.data as WorkflowInstance[], count: res.data.count as number }),
  });

  const filtered = (data?.items ?? []).filter((i) => {
    if (!search) return true;
    return i.currentStateName.toLowerCase().includes(search.toLowerCase()) || i.id.includes(search);
  });

  const columns: ColumnDef<WorkflowInstance>[] = [
    {
      header: "ID",
      cell: ({ row }) => <CopyableId id={row.original.id} />,
    },
    { accessorKey: "currentStateName", header: "Current State" },
    {
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: "Version",
      cell: ({ row }) => <span className="text-muted-foreground">v{row.original.definitionVersion}</span>,
    },
    {
      header: "Created",
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{formatDate(row.original.createdAt)}</span>,
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <Button size="sm" variant="outline" onClick={() => navigate(`/instances/${row.original.id}`)}>
          View
        </Button>
      ),
    },
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Instances"
        actions={
          <Button size="sm" onClick={() => navigate("/instances/new")}>
            <Plus className="h-4 w-4 mr-1" /> New Instance
          </Button>
        }
      />

      <div className="flex gap-3 mb-6">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Play} title="No instances" description="Create a new instance to get started." actionLabel="New Instance" onAction={() => navigate("/instances/new")} />
      ) : (
        <DataTable columns={columns} data={filtered} totalCount={data?.count} page={page} pageSize={limit} onPageChange={setPage} />
      )}
    </div>
  );
}
