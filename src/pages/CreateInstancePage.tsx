/**
 * CreateInstancePage — Two-step flow: select published workflow, fill dynamic form, create instance.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { unwrap } from "@/lib/api-helpers";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Rocket } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import type { WorkflowDefinition, FormSchemaField, WorkflowInstance } from "@/types/api";

export default function CreateInstancePage() {
  const navigate = useNavigate();
  const [selectedDef, setSelectedDef] = useState<WorkflowDefinition | null>(null);
  const [payload, setPayload] = useState<Record<string, any>>({});

  // Fetch published definitions
  const { data: defs, isLoading } = useQuery({
    queryKey: queryKeys.workflowDefinitions.list({ status: "published" }),
    queryFn: () => apiClient.get("/api/v1/workflow-definitions?status=published&page=1&limit=100"),
    select: (res) => res.data.data as WorkflowDefinition[],
  });

  // Fetch form schema for selected definition
  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: queryKeys.workflowDefinitions.formSchema(selectedDef?.id ?? ""),
    queryFn: () => apiClient.get(`/api/v1/workflow-definitions/${selectedDef!.id}/instance-form-schema`).then((r) => unwrap<{ fields: FormSchemaField[] }>(r)),
    enabled: !!selectedDef,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.post("/api/v1/workflow-instances", {
        workflowDefinitionId: selectedDef!.id,
        payload,
      }).then((r) => unwrap<WorkflowInstance>(r)),
    onSuccess: (inst) => {
      toast.success("Instance created!");
      navigate(`/instances/${inst.id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const fields = schema?.fields ?? [];

  const updateField = (key: string, value: any) => {
    setPayload((p) => ({ ...p, [key]: value }));
  };

  // Validate required fields
  const isValid = fields.filter((f) => f.required).every((f) => {
    const val = payload[f.key];
    return val !== undefined && val !== "";
  });

  if (isLoading) return <LoadingSpinner />;

  // Step 1: Select workflow
  if (!selectedDef) {
    return (
      <div>
        <PageHeader title="Create Instance" subtitle="Select a published workflow" />
        {(defs?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground text-sm">No published workflows available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {defs?.map((d) => (
              <Card key={d.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => { setSelectedDef(d); setPayload({}); }}>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-1">{d.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>v{d.currentVersion}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  {d.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{d.description}</p>}
                </CardContent>
              </Card>
            ))}
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
      <PageHeader title="Fill Instance Data" subtitle={`Workflow: ${selectedDef.name} v${selectedDef.currentVersion}`} />

      {schemaLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">This workflow has no form fields. Click create to start.</p>
          ) : (
            fields.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label>
                  {f.label || f.key}
                  {f.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {f.type === "boolean" ? (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!payload[f.key]}
                      onCheckedChange={(c) => updateField(f.key, !!c)}
                    />
                    <span className="text-sm">Yes</span>
                  </div>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : "text"}
                    value={payload[f.key] ?? ""}
                    onChange={(e) => updateField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                    placeholder={f.label || f.key}
                  />
                )}
              </div>
            ))
          )}

          <Button className="w-full" disabled={createMutation.isPending || !isValid} onClick={() => createMutation.mutate()}>
            <Rocket className="h-4 w-4 mr-1" />
            {createMutation.isPending ? "Creating…" : "Create Instance"}
          </Button>
        </div>
      )}
    </div>
  );
}
