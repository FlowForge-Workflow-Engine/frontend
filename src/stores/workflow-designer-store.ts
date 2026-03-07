/**
 * Workflow Designer Store — Zustand store for designer page state.
 * Stores the current workflow definition, states, transitions, rules, and form schema.
 */
import { create } from "zustand";
import type {
  WorkflowDefinition,
  WorkflowState,
  WorkflowTransition,
  TransitionRule,
  FormSchemaField,
  RuleMetadata,
} from "@/types/api";

interface WorkflowDesignerStore {
  definitionId: string | null;
  definitionName: string;
  definitionStatus: "draft" | "published" | "deprecated";
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  rules: Record<string, TransitionRule[]>;
  formSchema: FormSchemaField[];
  ruleMetadata: RuleMetadata | null;
  selectedStateId: string | null;
  selectedTransitionId: string | null;

  setDefinition: (def: WorkflowDefinition) => void;
  setStates: (states: WorkflowState[]) => void;
  setTransitions: (transitions: WorkflowTransition[]) => void;
  setRulesForTransition: (transitionId: string, rules: TransitionRule[]) => void;
  setFormSchema: (fields: FormSchemaField[]) => void;
  setRuleMetadata: (metadata: RuleMetadata) => void;
  setSelectedState: (id: string | null) => void;
  setSelectedTransition: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  definitionId: null,
  definitionName: "",
  definitionStatus: "draft" as const,
  states: [],
  transitions: [],
  rules: {},
  formSchema: [],
  ruleMetadata: null,
  selectedStateId: null,
  selectedTransitionId: null,
};

export const useWorkflowDesignerStore = create<WorkflowDesignerStore>((set) => ({
  ...initialState,

  setDefinition: (def) =>
    set({
      definitionId: def.id,
      definitionName: def.name,
      definitionStatus: def.status,
    }),

  setStates: (states) => set({ states }),
  setTransitions: (transitions) => set({ transitions }),
  setRulesForTransition: (transitionId, rules) =>
    set((state) => ({
      rules: { ...state.rules, [transitionId]: rules },
    })),
  setFormSchema: (fields) => set({ formSchema: fields }),
  setRuleMetadata: (metadata) => set({ ruleMetadata: metadata }),
  setSelectedState: (id) => set({ selectedStateId: id }),
  setSelectedTransition: (id) => set({ selectedTransitionId: id }),
  reset: () => set(initialState),
}));
