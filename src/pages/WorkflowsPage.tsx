/**
 * WorkflowsPage — List workflow definitions with search, filter, and create dialog.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { unwrap, unwrapList } from "@/lib/api-helpers";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, GitBranch, Trash2 } from "lucide-react";
import { formatDate } from "@/utils/format-date";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import type { WorkflowDefinition } from "@/types/api";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roles.includes("Admin");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.workflowDefinitions.list({ page, limit: 100 }),
    queryFn: () => apiClient.get(`/api/v1/workflow-definitions?page=${page}&limit=100`),
    select: (res) => ({ items: res.data.data as WorkflowDefinition[], count: res.data.count as number }),
  });

  const { register, handleSubmit, reset, formState: { errors: formErrors } } = useForm({
    resolver: zodResolver(createSchema),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      apiClient.post("/api/v1/workflow-definitions", body).then((r) => unwrap<WorkflowDefinition>(r)),
    onSuccess: (def) => {
      qc.invalidateQueries({ queryKey: ["workflow-definitions"] });
      setDialogOpen(false);
      reset();
      toast.success("Workflow created!");
      navigate(`/workflows/${def.id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/workflow-definitions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-definitions"] });
      toast.success("Workflow deleted");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Client-side filter
  const filtered = (data?.items ?? []).filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <PageHeader
        title="Workflows"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Workflow</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Workflow</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit((d) => createMutation.mutate(d as any))} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input {...register("name")} placeholder="My Workflow" />
                  {formErrors.name && <p className="text-xs text-destructive">{formErrors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea {...register("description")} placeholder="Optional description" />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filter bar */}
      <div className="flex gap-3 mb-6">
        <Input
          placeholder="Search workflows…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No workflows yet"
          description="Create your first workflow to get started."
          actionLabel="Create Workflow"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((def) => (
            <Card key={def.id} className="hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/workflows/${def.id}`)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{def.name}</h3>
                    <p className="text-xs text-muted-foreground">v{def.currentVersion}</p>
                  </div>
                  <StatusBadge status={def.status} />
                </div>
                {def.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{def.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(def.createdAt)}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); navigate(`/workflows/${def.id}`); }}>
                      Open Designer
                    </Button>
                    {isAdmin && def.status === "draft" && (
                      <ConfirmDialog
                        title="Delete Workflow"
                        description={`Are you sure you want to delete "${def.name}"?`}
                        confirmLabel="Delete"
                        onConfirm={() => deleteMutation.mutate(def.id)}
                        trigger={
                          <Button size="sm" variant="ghost" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
