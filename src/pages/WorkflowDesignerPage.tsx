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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Edit,
  Info,
  Plus,
  Rocket,
  Trash2,
  ArrowRight,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import { formatDateTime } from "@/utils/format-date";
import type {
  WorkflowDefinition,
  WorkflowState,
  WorkflowTransition,
  TransitionRule,
  FormSchemaField,
  Role,
  WorkflowVersionListResponse,
  RuleMetadata,
  CreateTransitionRuleRequest,
} from "@/types/api";

/** Color palette for state nodes */
const stateColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

/** Expression operators from rule metadata */
const EXPRESSION_OPERATORS = [
  "equal",
  "notEqual",
  "lessThan",
  "lessThanInclusive",
  "greaterThan",
  "greaterThanInclusive",
  "in",
  "notIn",
  "contains",
  "doesNotContain",
];

const SCHEMA_FIELD_TYPES = ["string", "number", "boolean"] as const;

const normalizePayloadFieldKey = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("$.")) return trimmed.slice(2).trim();
  if (trimmed.startsWith("$")) return trimmed.slice(1).replace(/^\./, "").trim();
  return trimmed.replace(/^\./, "").trim();
};

const ensureJsonPath = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("$.")) return trimmed;
  if (trimmed.startsWith("$")) return `$.${trimmed.slice(1).replace(/^\./, "").trim()}`;
  return `$.${trimmed.replace(/^\./, "").trim()}`;
};

const formatSchemaFieldLabel = (key: string) =>
  key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

interface ConditionRow {
  fact: string;
  path: string;
  operator: string;
  value: string;
}

export default function WorkflowDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const setDefinition = useWorkflowDesignerStore((state) => state.setDefinition);
  const setStatesInStore = useWorkflowDesignerStore((state) => state.setStates);
  const setTransitionsInStore = useWorkflowDesignerStore((state) => state.setTransitions);
  const setFormSchemaInStore = useWorkflowDesignerStore((state) => state.setFormSchema);
  const setRuleMetadataInStore = useWorkflowDesignerStore((state) => state.setRuleMetadata);

  const [addStateOpen, setAddStateOpen] = useState(false);
  const [editStateOpen, setEditStateOpen] = useState(false);
  const [editingState, setEditingState] = useState<WorkflowState | null>(null);
  const [addTransOpen, setAddTransOpen] = useState(false);
  const [statesOpen, setStatesOpen] = useState(true);
  const [transOpen, setTransOpen] = useState(true);

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
  const [transAllowedRoles, setTransAllowedRoles] = useState<string[]>([]);

  // Rules state
  const [expandedTransId, setExpandedTransId] = useState<string | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleTransitionId, setRuleTransitionId] = useState<string | null>(null);

  // Rule builder form
  const [ruleName, setRuleName] = useState("");
  const [ruleOrder, setRuleOrder] = useState(0);
  const [ruleType, setRuleType] = useState<"expression" | "custom">("expression");
  const [logicalOp, setLogicalOp] = useState<"all" | "any">("all");
  const [conditions, setConditions] = useState<ConditionRow[]>([
    { fact: "", path: "", operator: "equal", value: "" },
  ]);
  const [customStrategy, setCustomStrategy] = useState("");
  const [customParams, setCustomParams] = useState("{}");
  const [payloadSchemaFields, setPayloadSchemaFields] = useState<FormSchemaField[]>([]);
  const [rulePreviewOpen, setRulePreviewOpen] = useState(false);

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
    //NOTE: Intentionally capped at 100 because a workflow definition cannot have more than 100 states.
    queryFn: () =>
      apiClient
        .get(`/api/v1/workflow-definitions/${id}/states?page=1&limit=100`)
        .then((r) => ({ items: r.data.data as WorkflowState[], count: r.data.count })),
    enabled: !!id,
  });

  // Fetch transitions
  const { data: transData, isLoading: transLoading } = useQuery({
    queryKey: queryKeys.workflowDefinitions.transitions(id!),
    //NOTE: Intentionally capped at 100 because a workflow definition cannot have more than 100 transitions.
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
  const { data: versionsData } = useQuery({
    queryKey: queryKeys.workflowDefinitions.versions(id!),
    queryFn: () =>
      apiClient
        .get(`/api/v1/workflow-definitions/${id}/versions`)
        .then((r) => unwrap<WorkflowVersionListResponse>(r)),
    enabled: !!id,
  });

  // Resolve publishedBy user IDs to names
  const versionUserIds = useMemo(() => {
    const ids = new Set<string>();
    versionsData?.versions?.forEach((v) => {
      if (v.publishedBy) ids.add(v.publishedBy);
    });
    return Array.from(ids);
  }, [versionsData]);

  const versionRows = useMemo(() => {
    const publishedVersions = [...(versionsData?.versions ?? [])].sort(
      (a, b) => b.versionNumber - a.versionNumber,
    );
    const currentVersion = versionsData?.currentVersion;

    const rows = publishedVersions.map((v) => ({
      versionNumber: v.versionNumber,
      isCurrent: v.versionNumber === currentVersion,
      publishedBy: v.publishedBy,
      publishedAt: v.publishedAt,
    }));

    if (currentVersion && !publishedVersions.some((v) => v.versionNumber === currentVersion)) {
      rows.unshift({
        versionNumber: currentVersion,
        isCurrent: true,
        publishedBy: null,
        publishedAt: null,
      });
    }

    return rows.sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.versionNumber - a.versionNumber;
    });
  }, [versionsData]);

  const [versionUsers, setVersionUsers] = useState<Record<string, { firstName: string; lastName: string }>>(
    {},
  );

  useEffect(() => {
    if (versionUserIds.length === 0) return;
    const missing = versionUserIds.filter((uid) => !versionUsers[uid]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map((uid) =>
        apiClient
          .get(`/api/v1/users/${uid}`)
          .then((r) => {
            const u = r.data.data ?? r.data;
            return { id: uid, firstName: u.firstName, lastName: u.lastName };
          })
          .catch(() => ({ id: uid, firstName: "Unknown", lastName: "" })),
      ),
    ).then((results) => {
      setVersionUsers((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          next[r.id] = { firstName: r.firstName, lastName: r.lastName };
        });
        return next;
      });
    });
  }, [versionUserIds, versionUsers]);

  // Fetch roles for transition form
  const { data: rolesData } = useQuery({
    queryKey: queryKeys.roles.list(),
    queryFn: () => apiClient.get("/api/v1/roles").then((r) => r.data.data as Role[]),
  });

  // Fetch rule metadata (cached globally)
  const { data: ruleMetadata } = useQuery({
    queryKey: queryKeys.ruleMetadata.all(),
    queryFn: () => apiClient.get("/api/v1/workflow-rules/metadata").then((r) => unwrap<RuleMetadata>(r)),
    staleTime: 1000 * 60 * 30,
  });

  // Fetch rules for expanded transition
  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: queryKeys.workflowDefinitions.rules(id!, expandedTransId!),
    queryFn: () =>
      apiClient
        .get(`/api/v1/workflow-definitions/${id}/transitions/${expandedTransId}/rules`)
        .then((r) => r.data.data as TransitionRule[]),
    enabled: !!id && !!expandedTransId,
  });

  // Update store
  useEffect(() => {
    if (defData) setDefinition(defData);
  }, [defData, setDefinition]);
  useEffect(() => {
    if (statesData) setStatesInStore(statesData.items);
  }, [statesData, setStatesInStore]);
  useEffect(() => {
    if (transData) setTransitionsInStore(transData.items);
  }, [transData, setTransitionsInStore]);
  useEffect(() => {
    if (schemaData) setFormSchemaInStore(schemaData.fields || []);
  }, [schemaData, setFormSchemaInStore]);
  useEffect(() => {
    if (ruleMetadata) setRuleMetadataInStore(ruleMetadata);
  }, [ruleMetadata, setRuleMetadataInStore]);

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

  const systemPathOptionsByFact = useMemo(
    () => ({
      user: (ruleMetadata?.systemPaths ?? []).filter((item) => item.fact === "user"),
      instance: (ruleMetadata?.systemPaths ?? []).filter((item) => item.fact === "instance"),
    }),
    [ruleMetadata],
  );

  const payloadConditionKeys = useMemo(() => {
    if (ruleType !== "expression") return [];

    const seen = new Set<string>();
    return conditions.reduce<string[]>((keys, condition) => {
      if (condition.fact !== "payload") return keys;

      const normalizedKey = normalizePayloadFieldKey(condition.path);
      if (!normalizedKey || seen.has(normalizedKey)) return keys;

      seen.add(normalizedKey);
      keys.push(normalizedKey);
      return keys;
    }, []);
  }, [conditions, ruleType]);

  useEffect(() => {
    if (ruleType !== "expression") {
      setPayloadSchemaFields([]);
      return;
    }

    setPayloadSchemaFields((prev) =>
      payloadConditionKeys.map((key) => {
        const existingField =
          prev.find((field) => field.key === key) ?? schemaData?.fields?.find((field) => field.key === key);

        if (existingField) {
          return {
            ...existingField,
            type: SCHEMA_FIELD_TYPES.includes(existingField.type as (typeof SCHEMA_FIELD_TYPES)[number])
              ? existingField.type
              : "string",
            label: existingField.label || formatSchemaFieldLabel(key),
            required: true,
          };
        }

        return {
          key,
          type: "string",
          label: formatSchemaFieldLabel(key),
          required: true,
        };
      }),
    );
  }, [payloadConditionKeys, ruleType, schemaData]);

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

  const addRuleMut = useMutation({
    mutationFn: (body: any) =>
      apiClient.post(`/api/v1/workflow-definitions/${id}/transitions/${ruleTransitionId}/rules`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workflowDefinitions.rules(id!, ruleTransitionId!) });
      qc.invalidateQueries({ queryKey: queryKeys.workflowDefinitions.formSchema(id!) });
      setRuleDialogOpen(false);
      resetRuleForm();
      toast.success("Rule added");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteRuleMut = useMutation({
    mutationFn: ({ transitionId, ruleId }: { transitionId: string; ruleId: string }) =>
      apiClient.delete(`/api/v1/workflow-definitions/${id}/transitions/${transitionId}/rules/${ruleId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.workflowDefinitions.rules(id!, vars.transitionId) });
      qc.invalidateQueries({ queryKey: queryKeys.workflowDefinitions.formSchema(id!) });
      toast.success("Rule deleted");
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
    setTransAllowedRoles([]);
  };
  const resetRuleForm = () => {
    setRuleName("");
    setRuleOrder(0);
    setRuleType("expression");
    setLogicalOp("all");
    setConditions([{ fact: "", path: "", operator: "equal", value: "" }]);
    setCustomStrategy("");
    setCustomParams("{}");
    setPayloadSchemaFields([]);
    setRulePreviewOpen(false);
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

  const openRuleDialog = (transitionId: string) => {
    resetRuleForm();
    setRuleTransitionId(transitionId);
    setRuleDialogOpen(true);
  };

  /** Build ruleDefinition JSON from form state */
  const buildRuleDefinition = () => {
    if (ruleType === "custom") {
      try {
        return { strategy: customStrategy, params: JSON.parse(customParams) };
      } catch {
        return { strategy: customStrategy, params: {} };
      }
    }
    // Expression type
    const condArray = conditions
      .filter((c) => c.fact && c.operator)
      .map((c) => {
        const cond: Record<string, unknown> = {
          fact: c.fact,
          ...(c.path ? { path: c.path } : {}),
          operator: c.operator,
          value: c.value,
        };
        // Auto-convert numeric values
        if (!isNaN(Number(c.value)) && c.value.trim() !== "") {
          cond.value = Number(c.value);
        }
        return cond;
      });
    return { [logicalOp]: condArray };
  };

  const handleSubmitRule = () => {
    const body: CreateTransitionRuleRequest = {
      ruleName,
      evaluationOrder: ruleOrder,
      ruleDefinition: buildRuleDefinition(),
      ...(payloadSchemaFields.length > 0 ? { schemaFields: payloadSchemaFields } : {}),
    };

    addRuleMut.mutate(body);
  };

  // Condition row helpers
  const updateCondition = (idx: number, field: keyof ConditionRow, value: string) => {
    setConditions((prev) =>
      prev.map((condition, i) => {
        if (i !== idx) return condition;

        if (field === "fact" && value === "payload") {
          const normalizedPath = normalizePayloadFieldKey(condition.path);
          return {
            ...condition,
            fact: value,
            path: normalizedPath ? `$.${normalizedPath}` : condition.path || "$.",
          };
        }

        if (field === "fact" && (value === "user" || value === "instance")) {
          const options = systemPathOptionsByFact[value];
          const trimmedPath = condition.path.trim();
          const jsonPath = ensureJsonPath(trimmedPath);
          const matchingOption = options.find(
            (option) =>
              option.path === trimmedPath || option.path === jsonPath || option.fullPath === trimmedPath,
          );

          return {
            ...condition,
            fact: value,
            path: matchingOption?.path ?? options[0]?.path ?? jsonPath,
          };
        }

        if (field === "path" && ["payload", "user", "instance"].includes(condition.fact)) {
          return { ...condition, path: ensureJsonPath(value) };
        }

        return { ...condition, [field]: value };
      }),
    );
  };
  const addConditionRow = () =>
    setConditions((prev) => [...prev, { fact: "", path: "", operator: "equal", value: "" }]);
  const removeConditionRow = (idx: number) => setConditions((prev) => prev.filter((_, i) => i !== idx));
  const updatePayloadSchemaField = (key: string, field: "type" | "label", value: string) => {
    setPayloadSchemaFields((prev) =>
      prev.map((schemaField) => (schemaField.key === key ? { ...schemaField, [field]: value } : schemaField)),
    );
  };

  const getSystemPathDescription = (fact: string, path: string) => {
    if (fact !== "user" && fact !== "instance") return null;

    return systemPathOptionsByFact[fact].find((item) => item.path === path)?.description ?? null;
  };

  if (defLoading || statesLoading || transLoading) return <LoadingSpinner />;

  const facts = ruleMetadata?.facts ?? ["payload", "instance", "user"];
  const operators = ruleMetadata?.expressionOperators ?? EXPRESSION_OPERATORS;
  const customStrategies = ruleMetadata?.customStrategies ?? [];
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

      <Tabs defaultValue="design" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-6 mt-2 w-fit">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="form-schema">Form Schema</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        {/* Design Tab */}
        <TabsContent value="design" className="flex-1 flex overflow-hidden mt-2">
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
                  const isExpanded = expandedTransId === t.id;
                  const transRules = isExpanded ? (rulesData ?? []) : [];
                  return (
                    <div key={t.id} className="rounded-lg bg-muted/50 text-sm overflow-hidden">
                      <div className="p-2">
                        <div className="flex items-center justify-between">
                          <button
                            className="font-medium text-left flex-1 hover:text-primary transition-colors"
                            onClick={() => setExpandedTransId(isExpanded ? null : t.id)}
                          >
                            {t.name}
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setExpandedTransId(isExpanded ? null : t.id)}
                              className="p-1 hover:bg-accent rounded"
                              title="Show rules"
                            >
                              <Settings2
                                className={`h-3 w-3 transition-colors ${isExpanded ? "text-primary" : ""}`}
                              />
                            </button>
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
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          {from?.name || "?"} <ArrowRight className="h-3 w-3" /> {to?.name || "?"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {t.requiresComment && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Comment required
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rules sub-panel */}
                      {isExpanded && (
                        <div className="border-t bg-background/50 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Rules for {t.name}
                            </h4>
                            {isDraft && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                onClick={() => openRuleDialog(t.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Rule
                              </Button>
                            )}
                          </div>
                          {rulesLoading ? (
                            <p className="text-xs text-muted-foreground">Loading rules…</p>
                          ) : transRules.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">
                              No rules defined. Transition will always be allowed.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {transRules.map((rule) => (
                                <div
                                  key={rule.id}
                                  className="flex items-center justify-between p-2 rounded bg-muted/70 text-xs"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Badge variant="secondary" className="text-[10px] shrink-0">
                                      #{rule.evaluationOrder}
                                    </Badge>
                                    <span className="font-medium truncate">{rule.ruleName}</span>
                                  </div>
                                  {isDraft && (
                                    <ConfirmDialog
                                      title="Delete Rule"
                                      description={`Delete rule "${rule.ruleName}"?`}
                                      confirmLabel="Delete"
                                      onConfirm={() =>
                                        deleteRuleMut.mutate({ transitionId: t.id, ruleId: rule.id })
                                      }
                                      trigger={
                                        <button className="p-1 hover:bg-accent rounded shrink-0">
                                          <Trash2 className="h-3 w-3 text-destructive" />
                                        </button>
                                      }
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* ReactFlow Diagram */}
          <div className="flex-1 reactflow-wrapper">
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
        </TabsContent>

        {/* Form Schema Tab */}
        <TabsContent value="form-schema" className="flex-1 overflow-y-auto px-6 pt-3 pb-6 m-0">
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
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Key</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Label</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Required</th>
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
        </TabsContent>

        {/* Versions Tab */}
        <TabsContent value="versions" className="flex-1 overflow-y-auto px-6 pt-3 pb-6 m-0">
          <h3 className="text-lg font-semibold mb-4">Versions</h3>
          {versionRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published versions yet.</p>
          ) : (
            <div className="rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Version</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Published By</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Published At</th>
                  </tr>
                </thead>
                <tbody>
                  {versionRows.map((v) => {
                    const isCurrent = v.isCurrent;

                    return (
                      <tr
                        key={v.versionNumber}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {v.versionNumber}
                          {isCurrent ? <span className="ml-1 text-muted-foreground">(current)</span> : null}
                        </td>
                        <td className="px-4 py-3">
                          {!v.publishedBy ? (
                            <span className="text-muted-foreground text-xs">--</span>
                          ) : versionUsers[v.publishedBy] ? (
                            <span>
                              {versionUsers[v.publishedBy].firstName} {versionUsers[v.publishedBy].lastName}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Loading…</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!v.publishedAt ? (
                            <span className="text-muted-foreground text-xs">--</span>
                          ) : (
                            formatDateTime(v.publishedAt)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add State Dialog */}
      <Dialog open={addStateOpen} onOpenChange={setAddStateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add State</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name <span className="text-destructive">*</span></Label>
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
              <Label>Name <span className="text-destructive">*</span></Label>
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
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input value={transName} onChange={(e) => setTransName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>From State <span className="text-destructive">*</span></Label>
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
              <Label>To State <span className="text-destructive">*</span></Label>
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
            <div className="space-y-2">
              <Label>Allowed Roles</Label>
              <p className="text-xs text-muted-foreground">Only users with selected roles can perform this transition. Leave empty to allow all roles.</p>
              {transAllowedRoles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {transAllowedRoles.map((roleId) => {
                    const role = rolesData?.find((r) => r.id === roleId);
                    return (
                      <Badge key={roleId} variant="secondary" className="gap-1 pr-1">
                        {role?.name ?? roleId}
                        <button
                          type="button"
                          className="ml-0.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-muted"
                          onClick={() => setTransAllowedRoles((prev) => prev.filter((r) => r !== roleId))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between text-sm font-normal">
                    {transAllowedRoles.length > 0
                      ? `${transAllowedRoles.length} role${transAllowedRoles.length > 1 ? "s" : ""} selected`
                      : "Select roles…"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search roles…" />
                    <CommandList>
                      <CommandEmpty>No roles found.</CommandEmpty>
                      <CommandGroup>
                        {rolesData?.map((role) => {
                          const isSelected = transAllowedRoles.includes(role.id);
                          return (
                            <CommandItem
                              key={role.id}
                              value={role.name}
                              onSelect={() => {
                                setTransAllowedRoles((prev) =>
                                  isSelected ? prev.filter((r) => r !== role.id) : [...prev, role.id]
                                );
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                              {role.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
                  allowedRoleIds: transAllowedRoles,
                })
              }
            >
              {addTransMut.isPending ? "Adding…" : "Add Transition"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rule Builder Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Rule Name */}
            <div className="space-y-2">
              <Label>Rule Name <span className="text-destructive">*</span></Label>
              <Input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g. amount_exceeds_limit"
              />
            </div>

            {/* Evaluation Order */}
            <div className="space-y-2">
              <Label>Evaluation Order</Label>
              <Input
                type="number"
                value={ruleOrder}
                onChange={(e) => setRuleOrder(Number(e.target.value))}
                min={0}
              />
            </div>

            {/* Rule Type */}
            <div className="space-y-2">
              <Label>Rule Type</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="ruleType"
                    checked={ruleType === "expression"}
                    onChange={() => setRuleType("expression")}
                    className="accent-primary"
                  />
                  Expression
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="ruleType"
                    checked={ruleType === "custom"}
                    onChange={() => setRuleType("custom")}
                    className="accent-primary"
                  />
                  Custom
                </label>
              </div>
            </div>

            {/* Expression Builder */}
            {ruleType === "expression" && (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Logical operator:</Label>
                  <Select value={logicalOp} onValueChange={(v: "all" | "any") => setLogicalOp(v)}>
                    <SelectTrigger className="w-64 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ALL of these must pass</SelectItem>
                      <SelectItem value="any">ANY of these must pass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Conditions */}
                <div className="space-y-2">
                  {conditions.map((cond, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
                        <div>
                          {idx === 0 && <Label className="text-[10px] text-muted-foreground">Fact</Label>}
                          <Select value={cond.fact} onValueChange={(v) => updateCondition(idx, "fact", v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Fact" />
                            </SelectTrigger>
                            <SelectContent>
                              {facts.map((f) => (
                                <SelectItem key={f} value={f}>
                                  {f}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          {idx === 0 && <Label className="text-[10px] text-muted-foreground">Path</Label>}
                          {cond.fact === "user" || cond.fact === "instance" ? (
                            <Select value={cond.path} onValueChange={(v) => updateCondition(idx, "path", v)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select path" />
                              </SelectTrigger>
                              <SelectContent>
                                {systemPathOptionsByFact[cond.fact].map((systemPath) => (
                                  <SelectItem
                                    key={`${systemPath.fact}-${systemPath.path}`}
                                    value={systemPath.path}
                                  >
                                    {systemPath.fullPath || systemPath.path}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              className="h-8 text-xs"
                              value={cond.path}
                              onChange={(e) => updateCondition(idx, "path", e.target.value)}
                              placeholder={cond.fact === "payload" ? "$.fieldName" : ""}
                            />
                          )}
                        </div>
                        <div>
                          {idx === 0 && <Label className="text-[10px] text-muted-foreground">Operator</Label>}
                          <Select
                            value={cond.operator}
                            onValueChange={(v) => updateCondition(idx, "operator", v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {operators.map((op) => (
                                <SelectItem key={op} value={op}>
                                  {op}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          {idx === 0 && <Label className="text-[10px] text-muted-foreground">Value</Label>}
                          <Input
                            className="h-8 text-xs"
                            value={cond.value}
                            onChange={(e) => updateCondition(idx, "value", e.target.value)}
                            placeholder="Value"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeConditionRow(idx)}
                          className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-destructive disabled:opacity-30"
                          disabled={conditions.length === 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {getSystemPathDescription(cond.fact, cond.path) && (
                        <div className="flex items-start gap-1 rounded-md bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">
                          <Info className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{getSystemPathDescription(cond.fact, cond.path)}. CAN BE IGNORED</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={addConditionRow}>
                    <Plus className="h-3 w-3 mr-1" /> Add Condition
                  </Button>

                  {schemaData?.fields?.length ? (
                    <p className="text-[10px] text-muted-foreground">
                      Available schema fields: {schemaData.fields.map((field) => field.key).join(", ")}
                    </p>
                  ) : null}
                </div>

                {payloadSchemaFields.length > 0 && (
                  <div className="space-y-3 rounded-lg border border-dashed bg-background/80 p-3">
                    <div>
                      <h4 className="text-sm font-medium">This rule references payload fields</h4>
                      <div
                        role="note"
                        className="mt-2 flex items-start gap-2 rounded-md border border-status-draft/30 bg-status-draft/10 px-3 py-2 text-xs text-status-draft"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          Important: these payload fields must be provided during instance creation. If any of
                          them are missing, instance creation will fail.
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {payloadSchemaFields.map((field, idx) => (
                        <div
                          key={field.key}
                          className="grid gap-2 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end"
                        >
                          <div>
                            {idx === 0 && <Label className="text-[10px] text-muted-foreground">Key</Label>}
                            <Input className="h-8 text-xs bg-muted" value={field.key} readOnly />
                          </div>

                          <div>
                            {idx === 0 && <Label className="text-[10px] text-muted-foreground">Type</Label>}
                            <Select
                              value={field.type}
                              onValueChange={(value) => updatePayloadSchemaField(field.key, "type", value)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SCHEMA_FIELD_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            {idx === 0 && <Label className="text-[10px] text-muted-foreground">Label</Label>}
                            <Input
                              className="h-8 text-xs"
                              value={field.label}
                              onChange={(e) => updatePayloadSchemaField(field.key, "label", e.target.value)}
                              placeholder="Human-readable label"
                            />
                          </div>

                          <label className="flex h-8 items-center gap-2 rounded-md border px-3 text-xs">
                            <Checkbox checked={field.required} disabled aria-readonly="true" />
                            Required
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Rule Builder */}
            {ruleType === "custom" && (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-xs">Strategy</Label>
                  <Select value={customStrategy} onValueChange={setCustomStrategy}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent>
                      {customStrategies.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Special UI for user-has-any-role strategy */}
                {customStrategy === "user-has-any-role" && rolesData ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Allowed Roles</Label>
                    <div className="flex flex-wrap gap-2">
                      {rolesData.map((role) => {
                        let params: any = {};
                        try {
                          params = JSON.parse(customParams);
                        } catch {}
                        const roleIds: string[] = params.roleIds ?? [];
                        const isSelected = roleIds.includes(role.id);
                        return (
                          <label key={role.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const next = checked
                                  ? [...roleIds, role.id]
                                  : roleIds.filter((r) => r !== role.id);
                                setCustomParams(JSON.stringify({ roleIds: next }));
                              }}
                            />
                            {role.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs">Params (JSON)</Label>
                    <Textarea
                      className="font-mono text-xs h-24"
                      value={customParams}
                      onChange={(e) => setCustomParams(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Rule Preview */}
            <Collapsible open={rulePreviewOpen} onOpenChange={setRulePreviewOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${rulePreviewOpen ? "rotate-180" : ""}`}
                />
                Preview ruleDefinition JSON
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto max-h-40">
                  {JSON.stringify(buildRuleDefinition(), null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>

            <Button
              className="w-full"
              disabled={
                addRuleMut.isPending ||
                !ruleName ||
                (ruleType === "expression" && conditions.every((c) => !c.fact)) ||
                (ruleType === "custom" && !customStrategy)
              }
              onClick={handleSubmitRule}
            >
              {addRuleMut.isPending ? "Adding…" : "Add Rule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
