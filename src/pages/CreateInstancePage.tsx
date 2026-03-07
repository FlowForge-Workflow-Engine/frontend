/**
 * CreateInstancePage — Two-step flow: select published workflow, fill dynamic form, create instance.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { unwrap, unwrapList } from "@/lib/api-helpers";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, Rocket } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import type { WorkflowDefinition, FormSchemaField, WorkflowInstance } from "@/types/api";

export default function CreateInstancePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedDef, setSelectedDef] = useState<WorkflowDefinition | null>(null);
  const [payload, setPayload] = useState<Record<string, any>>({});
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const queryParams = new URLSearchParams({
    status: "published",
    page: String(page),
    limit: String(pageSize),
  });

  // Fetch published definitions
  const { data: defsData, isLoading } = useQuery({
    queryKey: queryKeys.workflowDefinitions.list({ status: "published", page, limit: pageSize }),
    queryFn: () => apiClient.get(`/api/v1/workflow-definitions?${queryParams}`),
    select: (res) => unwrapList<WorkflowDefinition>(res),
  });

  // Fetch form schema for selected definition
  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: queryKeys.workflowDefinitions.formSchema(selectedDef?.id ?? ""),
    queryFn: () =>
      apiClient
        .get(`/api/v1/workflow-definitions/${selectedDef!.id}/instance-form-schema`)
        .then((r) => unwrap<{ fields: FormSchemaField[] }>(r)),
    enabled: !!selectedDef,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient
        .post("/api/v1/workflow-instances", {
          workflowDefinitionId: selectedDef!.id,
          payload,
        })
        .then((r) => unwrap<WorkflowInstance>(r)),
    onSuccess: async (inst) => {
      await qc.invalidateQueries({ queryKey: ["workflow-instances", "list"] });
      toast.success("Instance created!");
      navigate(`/instances/${inst.id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const fields = schema?.fields ?? [];
  const defs = defsData?.items ?? [];
  const totalDefs = defsData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalDefs / pageSize));

  const updateField = (key: string, value: any) => {
    setPayload((p) => ({ ...p, [key]: value }));
  };

  // Validate required fields
  const isValid = fields
    .filter((f) => f.required)
    .every((f) => {
      const val = payload[f.key];
      return val !== undefined && val !== "";
    });

  if (isLoading) return <LoadingSpinner />;

  // Step 1: Select workflow
  if (!selectedDef) {
    return (
      <div>
        <PageHeader title="Create Instance" subtitle="Select a published workflow" />
        {totalDefs === 0 ? (
          <p className="text-muted-foreground text-sm">No published workflows available.</p>
        ) : (
          <div className="space-y-6">
            {defs.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
                No published workflows are available on this page.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {defs.map((d) => (
                  <Card
                    key={d.id}
                    className="cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => {
                      setSelectedDef(d);
                      setPayload({});
                    }}
                  >
                    <CardContent className="p-5">
                      <h3 className="font-semibold mb-1">{d.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>v{d.currentVersion}</span>
                        <StatusBadge status={d.status} />
                      </div>
                      {d.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{d.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {totalDefs > pageSize && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalDefs)} of {totalDefs}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Step 2: Fill form
  return (
    <div className="max-w-lg mx-auto">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => setSelectedDef(null)}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>
      <PageHeader
        title="Fill Instance Data"
        subtitle={`Workflow: ${selectedDef.name} v${selectedDef.currentVersion}`}
      />

      {schemaLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">
              This workflow has no form fields. Click create to start.
            </p>
          ) : (
            <>
              <div
                role="note"
                className="mt-2 flex items-start gap-2 rounded-md border border-status-draft/30 bg-status-draft/10 px-3 py-2 text-xs text-status-draft"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Important: these payload fields must be provided during instance creation. If any of them
                  are missing, instance creation will fail.
                </span>
              </div>

              {fields.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label>
                    {f.key || f.key}
                    {f.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {f.type === "boolean" ? (
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!payload[f.key]} onCheckedChange={(c) => updateField(f.key, !!c)} />
                      <span className="text-sm">Yes</span>
                    </div>
                  ) : (
                    <Input
                      type={f.type === "number" ? "number" : "text"}
                      value={payload[f.key] ?? ""}
                      onChange={(e) =>
                        updateField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)
                      }
                      placeholder={f.label || f.key}
                    />
                  )}
                </div>
              ))}
            </>
          )}

          <Button
            className="w-full"
            disabled={createMutation.isPending || !isValid}
            onClick={() => createMutation.mutate()}
          >
            <Rocket className="h-4 w-4 mr-1" />
            {createMutation.isPending ? "Creating…" : "Create Instance"}
          </Button>
        </div>
      )}
    </div>
  );
}
