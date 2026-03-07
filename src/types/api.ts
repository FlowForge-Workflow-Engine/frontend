/**
 * FlowForge API Types
 * All TypeScript interfaces matching the backend API schemas.
 */

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface RegisterTenantRequest {
  tenantName: string;
  tenantSlug: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface RegisterTenantResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; firstName: string; lastName: string };
  tenant: { id: string; name: string; slug: string };
}

export interface RegisterUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  tenantSlug: string;
}

export interface RegisterUserResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; firstName: string; lastName: string };
  tenant: { id: string; name: string; slug: string };
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantId: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  firstName: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  roleIds: string[];
  plan: string;
  iat: number;
  exp: number;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: RoleSummary[];
}

export interface RoleSummary {
  id: string;
  name: string;
  isSystemRole: boolean;
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roleNames?: string[];
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Tenant ──────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  id: string;
  tenantId: string;
  maxWorkflowDefinitions: number;
  maxUsers: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlag {
  id: string;
  tenantId: string;
  key: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Workflow Definitions ────────────────────────────────────────────────────

export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  currentVersion: number;
  status: "draft" | "published" | "deprecated";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowState {
  id: string;
  tenantId: string;
  workflowDefinitionId: string;
  name: string;
  description: string | null;
  isInitial: boolean;
  isTerminal: boolean;
  positionX: number | null;
  positionY: number | null;
  metadata: { color?: string; icon?: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTransition {
  id: string;
  tenantId: string;
  workflowDefinitionId: string;
  name: string;
  fromStateId: string;
  toStateId: string;
  allowedRoleIds: string[];
  requiresComment: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransitionRule {
  id: string;
  tenantId: string;
  transitionId: string;
  ruleName: string;
  ruleDefinition: object;
  evaluationOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormSchemaField {
  key: string;
  type: string;
  label: string;
  required: boolean;
}

export interface WorkflowVersion {
  id: string;
  workflowDefinitionId: string;
  versionNumber: number;
  snapshot: object;
  publishedBy: string;
  publishedAt: string;
  createdAt: string;
}

// ─── Instances ───────────────────────────────────────────────────────────────

export interface WorkflowInstance {
  id: string;
  tenantId: string;
  workflowDefinitionId: string;
  definitionVersion: number;
  currentStateId: string;
  currentStateName: string;
  payload: Record<string, unknown>;
  status: "active" | "completed" | "cancelled";
  version: number;
  createdBy: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AllowedTransition {
  id: string;
  name: string;
  fromStateId: string;
  toStateId: string;
  requiresComment: boolean;
  toStateName?: string;
}

export interface ExecuteTransitionRequest {
  transitionId: string;
  lastKnownVersion: number;
  comment?: string;
  idempotencyKey?: string;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  tenantId: string;
  instanceId: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  actionType: string;
  transitionId: string | null;
  transitionName: string | null;
  fromState: string | null;
  toState: string | null;
  comment: string | null;
  eventId: string;
  occurredAt: string;
  createdAt: string;
}

// ─── Rule Metadata ───────────────────────────────────────────────────────────

export interface RuleMetadata {
  facts: string[];
  ruleTypes: string[];
  customStrategies: string[];
  expressionOperators: string[];
  systemPaths: Array<{ fact: string; path: string; description: string }>;
  payloadPathFormat: string;
  expressionRuleDefinitionExample: object;
  customRuleDefinitionExample: object;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface NotificationTemplate {
  id: string;
  tenantId: string;
  eventTrigger: string;
  channel: "email" | "webhook";
  subjectTemplate: string | null;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationTemplateRequest {
  eventTrigger: string;
  channel: "email" | "webhook";
  subjectTemplate?: string;
  bodyTemplate: string;
  isActive?: boolean;
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export interface WebhookConfig {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  secret: string;
  eventTriggers: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookConfigRequest {
  name: string;
  url: string;
  secret: string;
  eventTriggers: string[];
  isActive?: boolean;
}

// ─── API Response Wrappers ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  status: string;
  data: T;
}

export interface ApiListResponse<T> {
  status: string;
  count: number;
  data: T[];
}

export interface ApiError {
  statusCode: number;
  errorCode: string;
  message: string;
  timestamp: string;
  path: string;
}
