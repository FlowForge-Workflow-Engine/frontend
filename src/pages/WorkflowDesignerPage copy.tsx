/**
 * WorkflowDesignerPage — Visual workflow designer with states, transitions, rules, and ReactFlow diagram.
 */
import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { apiClient } from "@/lib/api-client";
import { unwrap } from "@/lib/api-helpers";
import { queryKeys } from "@/lib/query-keys";
import { useWorkflowDesignerStore } from "@/stores/workflow-designer-store";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, ChevronDown, Edit, Plus, Rocket, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import { formatDateTime } from "@/utils/format-date";
import type {
  WorkflowDefinition,
  WorkflowState,
  WorkflowTransition,
  FormSchemaField,
  WorkflowVersion,
} from "@/types/api";

/** Color palette for state nodes */
const stateColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const normalizeVersionsResponse = (response: { data: any }) => {
  const root = response.data;
  const payload = root?.data ?? root;
  const itemSource = payload?.data ?? payload?.items ?? payload;
  const items = Array.isArray(itemSource) ? (itemSource as WorkflowVersion[]) : [];
  const count =
    typeof root?.count === "number"
      ? root.count
      : typeof payload?.count === "number"
        ? payload.count
        : items.length;

  return { items, count };
};

const getPublishedByLabel = (publishedBy: unknown) => {
  if (typeof publishedBy === "string" && publishedBy.trim().length > 0) {
    return publishedBy.length > 24 ? `${publishedBy.slice(0, 24)}…` : publishedBy;
  }

  if (publishedBy && typeof publishedBy === "object") {
    const candidate = ["name", "email", "id"]
      .map((key) => (publishedBy as Record<string, unknown>)[key])
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);

    if (candidate) {
      return candidate.length > 24 ? `${candidate.slice(0, 24)}…` : candidate;
    }
  }

  return "—";
};

const formatMaybeDateTime = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return formatDateTime(value);
};

export default function WorkflowDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const store = useWorkflowDesignerStore();

  const [addStateOpen, setAddStateOpen] = useState(false);
  const [editStateOpen, setEditStateOpen] = useState(false);
  const [editingState, setEditingState] = useState<WorkflowState | null>(null);
  const [addTransOpen, setAddTransOpen] = useState(false);
  const [statesOpen, setStatesOpen] = useState(true);
  const [transOpen, setTransOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("design");

  // State form
  const [stateName, setStateName] = useState("");
  const [stateDesc, setStateDesc] = useState("");
  const [stateIsInitial, setStateIsInitial] = useState(false);
  const [stateIsTerminal, setStateIsTerminal] = useState(false);
  const [stateColor, setStateColor] = useState(stateColors[0]);

  // Transition form
  const [transName, setTransName] = useState("");
  const [transFrom, setTransFrom] = useState("");
  const [transTo, setTransTo] = useState("");
  const [transComment, setTransComment] = useState(false);

  // Fetch definition
  const { data: defData, isLoading: defLoading } = useQuery({
    queryKey: queryKeys.workflowDefinitions.detail(id!),
    queryFn: () =>
      apiClient.get(`/api/v1/workflow-definitions/${id}`).then((r) => unwrap<WorkflowDefinition>(r)),
    enabled: !!id,
  });

  // Fetch states
  const { data: statesData, isLoading: statesLoading } = useQuery({
    queryKey: queryKeys.workflowDefinitions.states(id!),
    queryFn: () =>
      apiClient
        .get(`/api/v1/workflow-definitions/${id}/states?page=1&limit=100`)
        .then((r) => ({ items: r.data.data as WorkflowState[], count: r.data.count })),
    enabled: !!id,
  });

  // Fetch transitions
  const { data: transData, isLoading: transLoading } = useQuery({
    queryKey: queryKeys.workflowDefinitions.transitions(id!),
    queryFn: () =>
      apiClient
        .get(`/api/v1/workflow-definitions/${id}/transitions?page=1&limit=100`)
        .then((r) => ({ items: r.data.data as WorkflowTransition[], count: r.data.count })),
    enabled: !!id,
  });

  // Fetch form schema
  const { data: schemaData } = useQuery({
    queryKey: queryKeys.workflowDefinitions.formSchema(id!),
    queryFn: () =>
      apiClient
        .get(`/api/v1/workflow-definitions/${id}/instance-form-schema`)
        .then((r) => unwrap<{ fields: FormSchemaField[] }>(r)),
    enabled: !!id,
  });

  // Fetch versions
  const {
    data: versionsData,
    isLoading: versionsLoading,
    error: versionsError,
  } = useQuery({
    queryKey: queryKeys.workflowDefinitions.versions(id!),
    queryFn: () =>
      apiClient.get(`/api/v1/workflow-definitions/${id}/versions`).then((r) => normalizeVersionsResponse(r)),
    enabled: !!id,
  });

  // Update store
  useEffect(() => {
    if (defData) store.setDefinition(defData);
  }, [defData]);
  useEffect(() => {
    if (statesData) store.setStates(statesData.items);
  }, [statesData]);
  useEffect(() => {
    if (transData) store.setTransitions(transData.items);
  }, [transData]);
  useEffect(() => {
    if (schemaData) store.setFormSchema(schemaData.fields || []);
  }, [schemaData]);

  const isDraft = defData?.status === "draft";
  const states = statesData?.items ?? [];
  const transitions = transData?.items ?? [];

  // ReactFlow nodes/edges
  const rfNodes: Node[] = useMemo(
    () =>
      states.map((s, i) => ({
        id: s.id,
        position: { x: s.positionX ?? 100 + (i % 3) * 250, y: s.positionY ?? 100 + Math.floor(i / 3) * 150 },
        data: { label: s.name },
        style: {
          background: s.metadata?.color || stateColors[i % stateColors.length],
          color: "#fff",
          borderRadius: 12,
          padding: "12px 20px",
          fontWeight: 600,
          fontSize: 13,
          border: s.isTerminal ? "3px double #fff" : s.isInitial ? "3px solid #22c55e" : "none",
          minWidth: 120,
          textAlign: "center" as const,
        },
      })),
    [states],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      transitions.map((t) => ({
        id: t.id,
        source: t.fromStateId,
        target: t.toStateId,
        label: t.name.length > 20 ? t.name.slice(0, 20) + "…" : t.name,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 2 },
        labelStyle: { fontSize: 11, fontWeight: 500 },
      })),
    [transitions],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => {
    setNodes(rfNodes);
  }, [rfNodes]);
  useEffect(() => {
    setEdges(rfEdges);
  }, [rfEdges]);

  // Mutations
  const addStateMut = useMutation({
    mutationFn: (body: any) => apiClient.post(`/api/v1/workflow-definitions/${id}/states`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflowDefinitions.states(id!) });
      setAddStateOpen(false);
      resetStateForm();
      toast.success("State added");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const editStateMut = useMutation({
    mutationFn: ({ stateId, body }: { stateId: string; body: any }) =>
      apiClient.patch(`/api/v1/workflow-definitions/${id}/states/${stateId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflowDefinitions.states(id!) });
      setEditStateOpen(false);
      toast.success("State updated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteStateMut = useMutation({
    mutationFn: (stateId: string) => apiClient.delete(`/api/v1/workflow-definitions/${id}/states/${stateId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflowDefinitions.states(id!) });
      toast.success("State deleted");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const addTransMut = useMutation({
    mutationFn: (body: any) => apiClient.post(`/api/v1/workflow-definitions/${id}/transitions`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflowDefinitions.transitions(id!) });
      setAddTransOpen(false);
      resetTransForm();
      toast.success("Transition added");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteTransMut = useMutation({
    mutationFn: (tId: string) => apiClient.delete(`/api/v1/workflow-definitions/${id}/transitions/${tId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflowDefinitions.transitions(id!) });
      toast.success("Transition deleted");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const publishMut = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/workflow-definitions/${id}/publish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-definitions"] });
      toast.success("Workflow published!");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deprecateMut = useMutation({
    mutationFn: () => apiClient.post(`/api/v1/workflow-definitions/${id}/deprecate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-definitions"] });
      toast.success("Workflow deprecated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const resetStateForm = () => {
    setStateName("");
    setStateDesc("");
    setStateIsInitial(false);
    setStateIsTerminal(false);
    setStateColor(stateColors[0]);
  };
  const resetTransForm = () => {
    setTransName("");
    setTransFrom("");
    setTransTo("");
    setTransComment(false);
  };

  const handleEditState = (s: WorkflowState) => {
    setEditingState(s);
    setStateName(s.name);
    setStateDesc(s.description || "");
    setStateIsInitial(s.isInitial);
    setStateIsTerminal(s.isTerminal);
    setStateColor(s.metadata?.color || stateColors[0]);
    setEditStateOpen(true);
  };

  if (defLoading || statesLoading || transLoading) return <LoadingSpinner />;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col -m-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{defData?.name || "Workflow"}</h2>
          <StatusBadge status={defData?.status || "draft"} />
          <span className="text-sm text-muted-foreground">v{defData?.currentVersion}</span>
        </div>
        <div className="flex gap-2">
          {defData?.status === "draft" && (
            <ConfirmDialog
              title="Publish Workflow"
              description="Publishing will make this workflow available for creating instances. Continue?"
              confirmLabel="Publish"
              variant="default"
              onConfirm={() => publishMut.mutate()}
              trigger={
                <Button size="sm">
                  <Rocket className="h-4 w-4 mr-1" /> Publish
                </Button>
              }
            />
          )}
          {defData?.status === "published" && (
            <ConfirmDialog
              title="Deprecate Workflow"
              description="Deprecating will prevent new instances from being created. Continue?"
              confirmLabel="Deprecate"
              onConfirm={() => deprecateMut.mutate()}
              trigger={
                <Button size="sm" variant="outline">
                  <AlertTriangle className="h-4 w-4 mr-1" /> Deprecate
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Read-only banner */}
      {!isDraft && (
        <div className="bg-status-draft/10 text-status-draft px-6 py-2 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          This workflow is {defData?.status} and read-only. Create a new version to make changes.
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-6 mt-2 w-fit">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="form-schema">Form Schema</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        {activeTab === "design" && (
          <div className="mt-2 flex min-h-0 flex-1 overflow-hidden">
            {/* Left Panel */}
            <div className="w-80 border-r overflow-y-auto bg-card p-4 space-y-4">
              {/* States */}
              <Collapsible open={statesOpen} onOpenChange={setStatesOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold">
                  States ({states.length})
                  <ChevronDown className={`h-4 w-4 transition-transform ${statesOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {isDraft && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        resetStateForm();
                        setAddStateOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add State
                    </Button>
                  )}
                  {states.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ background: s.metadata?.color || stateColors[0] }}
                        />
                        <span className="font-medium">{s.name}</span>
                        {s.isInitial && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-status-completed/15 text-status-completed">
                            Initial
                          </span>
                        )}
                        {s.isTerminal && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                            Terminal
                          </span>
                        )}
                      </div>
                      {isDraft && (
                        <div className="flex gap-1">
                          <button onClick={() => handleEditState(s)} className="p-1 hover:bg-accent rounded">
                            <Edit className="h-3 w-3" />
                          </button>
                          <ConfirmDialog
                            title="Delete State"
                            description={`Delete "${s.name}"?`}
                            confirmLabel="Delete"
                            onConfirm={() => deleteStateMut.mutate(s.id)}
                            trigger={
                              <button className="p-1 hover:bg-accent rounded">
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              {/* Transitions */}
              <Collapsible open={transOpen} onOpenChange={setTransOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold">
                  Transitions ({transitions.length})
                  <ChevronDown className={`h-4 w-4 transition-transform ${transOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {isDraft && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        resetTransForm();
                        setAddTransOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Transition
                    </Button>
                  )}
                  {transitions.map((t) => {
                    const from = states.find((s) => s.id === t.fromStateId);
                    const to = states.find((s) => s.id === t.toStateId);
                    return (
                      <div key={t.id} className="p-2 rounded-lg bg-muted/50 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{t.name}</span>
                          {isDraft && (
                            <ConfirmDialog
                              title="Delete Transition"
                              description={`Delete "${t.name}"?`}
                              confirmLabel="Delete"
                              onConfirm={() => deleteTransMut.mutate(t.id)}
                              trigger={
                                <button className="p-1 hover:bg-accent rounded">
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </button>
                              }
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          {from?.name || "?"} <ArrowRight className="h-3 w-3" /> {to?.name || "?"}
                        </p>
                        {t.requiresComment && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground mt-1 inline-block">
                            Comment required
                          </span>
                        )}
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* ReactFlow Diagram */}
            <div className="flex-1 min-h-0">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </div>
          </div>
        )}

        {activeTab === "form-schema" && (
          <div className="mt-2 px-6 pb-6">
            <h3 className="text-lg font-semibold mb-2">Instance Form Schema</h3>
            <p className="text-sm text-muted-foreground mb-4">
              These fields are collected when creating a workflow instance.
            </p>
            {(schemaData?.fields?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No form fields defined yet. Add rules with payload conditions to generate form fields.
              </p>
            ) : (
              <div className="rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">Key</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Label</th>
                      <th className="px-4 py-2 text-left">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemaData?.fields?.map((f) => (
                      <tr key={f.key} className="border-b last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">{f.key}</td>
                        <td className="px-4 py-2">{f.type}</td>
                        <td className="px-4 py-2">{f.label}</td>
                        <td className="px-4 py-2">{f.required ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "versions" && (
          <div className="mt-2 px-6 pb-6">
            <h3 className="text-lg font-semibold mb-4">Versions</h3>
            {versionsLoading ? (
              <div className="py-8">
                <LoadingSpinner />
              </div>
            ) : versionsError ? (
              <p className="text-sm text-destructive">{getErrorMessage(versionsError)}</p>
            ) : (versionsData?.items?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No published versions yet.</p>
            ) : (
              <div className="rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">Version</th>
                      <th className="px-4 py-2 text-left">Published By</th>
                      <th className="px-4 py-2 text-left">Published At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionsData?.items?.map((v) => (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="px-4 py-2 font-medium">v{v.versionNumber}</td>
                        <td className="px-4 py-2 font-mono text-xs">{getPublishedByLabel(v.publishedBy)}</td>
                        <td className="px-4 py-2">{formatMaybeDateTime(v.publishedAt ?? v.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Tabs>

      {/* Add State Dialog */}
      <Dialog open={addStateOpen} onOpenChange={setAddStateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add State</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={stateName} onChange={(e) => setStateName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={stateDesc} onChange={(e) => setStateDesc(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={stateIsInitial} onCheckedChange={(c) => setStateIsInitial(!!c)} /> Initial
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={stateIsTerminal} onCheckedChange={(c) => setStateIsTerminal(!!c)} />{" "}
                Terminal
              </label>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {stateColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStateColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${stateColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={addStateMut.isPending || !stateName}
              onClick={() =>
                addStateMut.mutate({
                  name: stateName,
                  description: stateDesc || undefined,
                  isInitial: stateIsInitial,
                  isTerminal: stateIsTerminal,
                  metadata: { color: stateColor },
                })
              }
            >
              {addStateMut.isPending ? "Adding…" : "Add State"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit State Dialog */}
      <Dialog open={editStateOpen} onOpenChange={setEditStateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit State</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={stateName} onChange={(e) => setStateName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={stateDesc} onChange={(e) => setStateDesc(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={stateIsInitial} onCheckedChange={(c) => setStateIsInitial(!!c)} /> Initial
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={stateIsTerminal} onCheckedChange={(c) => setStateIsTerminal(!!c)} />{" "}
                Terminal
              </label>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {stateColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStateColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${stateColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={editStateMut.isPending || !stateName}
              onClick={() =>
                editStateMut.mutate({
                  stateId: editingState!.id,
                  body: {
                    name: stateName,
                    description: stateDesc || undefined,
                    isInitial: stateIsInitial,
                    isTerminal: stateIsTerminal,
                    metadata: { color: stateColor },
                  },
                })
              }
            >
              {editStateMut.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Transition Dialog */}
      <Dialog open={addTransOpen} onOpenChange={setAddTransOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={transName} onChange={(e) => setTransName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>From State</Label>
              <Select value={transFrom} onValueChange={setTransFrom}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {states.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To State</Label>
              <Select value={transTo} onValueChange={setTransTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {states
                    .filter((s) => s.id !== transFrom)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={transComment} onCheckedChange={(c) => setTransComment(!!c)} /> Requires
              Comment
            </label>
            <Button
              className="w-full"
              disabled={addTransMut.isPending || !transName || !transFrom || !transTo}
              onClick={() =>
                addTransMut.mutate({
                  name: transName,
                  fromStateId: transFrom,
                  toStateId: transTo,
                  requiresComment: transComment,
                  allowedRoleIds: [],
                })
              }
            >
              {addTransMut.isPending ? "Adding…" : "Add Transition"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
