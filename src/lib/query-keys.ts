/**
 * Query Keys — Organized factories for TanStack Query cache keys.
 */
export const queryKeys = {
  auth: { me: () => ["auth", "me"] as const },
  users: {
    list: (params?: object) => ["users", "list", params] as const,
    detail: (id: string) => ["users", id] as const,
  },
  roles: { list: () => ["roles", "list"] as const },
  tenants: {
    detail: (id: string) => ["tenants", id] as const,
    settings: (id: string) => ["tenants", id, "settings"] as const,
    featureFlags: (id: string) => ["tenants", id, "feature-flags"] as const,
  },
  workflowDefinitions: {
    list: (params?: object) => ["workflow-definitions", "list", params] as const,
    detail: (id: string) => ["workflow-definitions", id] as const,
    states: (id: string) => ["workflow-definitions", id, "states"] as const,
    transitions: (id: string) => ["workflow-definitions", id, "transitions"] as const,
    rules: (id: string, transitionId: string) =>
      ["workflow-definitions", id, "transitions", transitionId, "rules"] as const,
    formSchema: (id: string) => ["workflow-definitions", id, "form-schema"] as const,
    versions: (id: string) => ["workflow-definitions", id, "versions"] as const,
  },
  workflowInstances: {
    list: (params?: object) => ["workflow-instances", "list", params] as const,
    detail: (id: string) => ["workflow-instances", id] as const,
    allowedTransitions: (id: string) =>
      ["workflow-instances", id, "allowed-transitions"] as const,
    auditLogs: (id: string, params?: object) =>
      ["workflow-instances", id, "audit-logs", params] as const,
  },
  ruleMetadata: { all: () => ["rule-metadata"] as const },
  notificationTemplates: {
    list: () => ["notification-templates", "list"] as const,
    detail: (id: string) => ["notification-templates", id] as const,
  },
  webhookConfigs: {
    list: () => ["webhook-configs", "list"] as const,
    detail: (id: string) => ["webhook-configs", id] as const,
  },
};
