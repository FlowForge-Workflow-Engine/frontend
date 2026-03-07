/**
 * InstanceDetailPage — Runtime execution page with payload, transitions, and audit log.
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { unwrap } from "@/lib/api-helpers";
import { queryKeys } from "@/lib/query-keys";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CopyableId } from "@/components/common/CopyableId";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ArrowRight, CheckCircle, XCircle, Play, Ban } from "lucide-react";
import { formatDateTime } from "@/utils/format-date";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import type { WorkflowInstance, AllowedTransition, AuditLog } from "@/types/api";

/** Generate a simple UUID without external lib */
function genUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function InstanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [execDialog, setExecDialog] = useState<AllowedTransition | null>(null);
  const [comment, setComment] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [auditPage, setAuditPage] = useState(1);

  // Fetch instance
  const { data: instance, isLoading } = useQuery({
    queryKey: queryKeys.workflowInstances.detail(id!),
    queryFn: () => apiClient.get(`/api/v1/workflow-instances/${id}`).then((r) => unwrap<WorkflowInstance>(r)),
    enabled: !!id,
  });

  // Fetch allowed transitions (raw array, NOT wrapped)
  const { data: allowed } = useQuery({
    queryKey: queryKeys.workflowInstances.allowedTransitions(id!),
    queryFn: () =>
      apiClient
        .get(`/api/v1/workflow-instances/${id}/allowed-transitions`)
        .then((r) => r.data as AllowedTransition[]),
    enabled: !!id && instance?.status === "active",
  });

  // Fetch audit logs
  const { data: auditData } = useQuery({
    queryKey: queryKeys.workflowInstances.auditLogs(id!, { page: auditPage }),
    queryFn: () => apiClient.get(`/api/v1/workflow-instances/${id}/audit-logs?page=${auditPage}&limit=20`),
    select: (res) => ({ items: res.data.data as AuditLog[], count: res.data.count as number }),
    enabled: !!id,
  });

  // Execute transition
  const execMutation = useMutation({
    mutationFn: (body: {
      transitionId: string;
      lastKnownVersion: number;
      comment?: string;
      idempotencyKey: string;
    }) => apiClient.post(`/api/v1/workflow-instances/${id}/transitions`, body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["workflow-instances", "list"] }),
        qc.invalidateQueries({ queryKey: queryKeys.workflowInstances.detail(id!) }),
        qc.invalidateQueries({ queryKey: queryKeys.workflowInstances.allowedTransitions(id!) }),
        qc.invalidateQueries({ queryKey: queryKeys.workflowInstances.auditLogs(id!, { page: auditPage }) }),
      ]);
      setExecDialog(null);
      setComment("");
      toast.success(`Transitioned to ${execDialog?.toStateName || "next state"}`);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.errorCode;
      if (code === "TRANSITION_CONFLICT") {
        toast.error("Instance was updated by another user. Refreshing…");
        qc.invalidateQueries({ queryKey: queryKeys.workflowInstances.detail(id!) });
      } else {
        toast.error(getErrorMessage(err));
      }
    },
  });

  // Cancel instance
  const cancelMutation = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/workflow-instances/${id}/cancel`),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["workflow-instances", "list"] }),
        qc.invalidateQueries({ queryKey: queryKeys.workflowInstances.detail(id!) }),
      ]);
      toast.success("Instance cancelled");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const openExecDialog = (t: AllowedTransition) => {
    setExecDialog(t);
    setComment("");
    setIdempotencyKey(genUUID());
  };

  if (isLoading || !instance) return <LoadingSpinner />;

  const auditLogs = auditData?.items ?? [];

  const actionIcon = (actionType: string) => {
    switch (actionType) {
      case "instance_created":
        return <Plus className="h-4 w-4 text-status-active" />;
      case "transition_executed":
        return <ArrowRight className="h-4 w-4 text-status-completed" />;
      case "instance_completed":
        return <CheckCircle className="h-4 w-4 text-status-active" />;
      case "instance_cancelled":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  const actionLabel = (log: AuditLog) => {
    switch (log.actionType) {
      case "instance_created":
        return "Instance created";
      case "transition_executed":
        return `${log.fromState} → ${log.toState} via ${log.transitionName}`;
      case "instance_completed":
        return "Workflow completed";
      case "instance_cancelled":
        return "Instance cancelled";
      default:
        return log.actionType;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CopyableId id={instance.id} />
          <StatusBadge status={instance.status} />
          <span className="text-sm text-muted-foreground">v{instance.definitionVersion}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold px-3 py-1 rounded-lg bg-primary/10 text-primary">
            {instance.currentStateName}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Created {formatDateTime(instance.createdAt)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left — 60% */}
        <div className="lg:col-span-3 space-y-6">
          {/* Payload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Instance Data</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(instance.payload).length === 0 ? (
                <p className="text-sm text-muted-foreground">No payload data.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(instance.payload).map(([key, val]) => (
                    <div key={key} className="flex justify-between py-1.5 border-b last:border-0">
                      <span className="text-sm font-medium capitalize">{key}</span>
                      <span className="text-sm text-muted-foreground">
                        {typeof val === "boolean"
                          ? val
                            ? "Yes"
                            : "No"
                          : typeof val === "number"
                            ? val.toLocaleString()
                            : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Allowed Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {instance.status !== "active" ? (
                <p className="text-sm text-muted-foreground">
                  This instance is {instance.status} and can no longer be transitioned.
                </p>
              ) : (allowed?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No actions available.</p>
              ) : (
                <div className="space-y-2">
                  {allowed?.map((t, i) => {
                    /* Cycle through distinct accessible colors for each action button */
                    const actionColors = [
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      "bg-status-completed text-primary-foreground hover:bg-status-completed/90",
                      "bg-status-active text-primary-foreground hover:bg-status-active/90",
                      "bg-status-draft text-primary-foreground hover:bg-status-draft/90",
                    ];
                    const colorClass = actionColors[i % actionColors.length];
                    return (
                      <div key={t.id}>
                        <Button
                          variant="default"
                          className={`w-full justify-start ${colorClass}`}
                          onClick={() => openExecDialog(t)}
                        >
                          <ArrowRight className="h-4 w-4 mr-2" />
                          {t.name}
                          {t.toStateName && (
                            <span className="ml-auto text-xs opacity-80">→ {t.toStateName}</span>
                          )}
                        </Button>
                        {t.requiresComment && (
                          <p className="text-xs text-muted-foreground ml-10 mt-0.5">(Comment required)</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {instance.status === "active" && (
                <div className="mt-4 pt-4 border-t">
                  <ConfirmDialog
                    title="Cancel Instance"
                    description="Are you sure you want to cancel this instance? This action cannot be undone."
                    confirmLabel="Cancel Instance"
                    onConfirm={() => cancelMutation.mutate()}
                    trigger={
                      <Button variant="outline" className="w-full text-destructive border-destructive/30">
                        <Ban className="h-4 w-4 mr-2" /> Cancel Instance
                      </Button>
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right — Audit Log Timeline (40%) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        {actionIcon(log.actionType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{actionLabel(log)}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.actorEmail} {log.actorRole && `(${log.actorRole})`}
                        </p>
                        {log.comment && (
                          <p className="text-xs italic text-muted-foreground mt-0.5">"{log.comment}"</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDateTime(log.occurredAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {auditData && auditData.count > auditPage * 20 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setAuditPage((p) => p + 1)}
                    >
                      Load more
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Execute Transition Dialog */}
      <Dialog open={!!execDialog} onOpenChange={(open) => !open && setExecDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute: {execDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 py-3 bg-muted rounded-lg">
              <span className="font-medium">{instance.currentStateName}</span>
              <ArrowRight className="h-5 w-5 text-primary" />
              <span className="font-medium text-primary">{execDialog?.toStateName || "Next"}</span>
            </div>

            <div className="space-y-2">
              <Label>Comment {execDialog?.requiresComment ? "(required)" : "(optional)"}</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                placeholder="Add a comment…"
              />
              <p className="text-xs text-muted-foreground text-right">{comment.length}/1000</p>
            </div>

            <Button
              className="w-full"
              disabled={execMutation.isPending || (execDialog?.requiresComment && !comment.trim())}
              onClick={() =>
                execMutation.mutate({
                  transitionId: execDialog!.id,
                  lastKnownVersion: instance.version,
                  comment: comment.trim() || undefined,
                  idempotencyKey,
                })
              }
            >
              {execMutation.isPending ? "Executing…" : "Execute Transition"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
