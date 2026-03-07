/**
 * Error Messages — Map API error codes to user-friendly text.
 */

export const errorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  USER_INACTIVE: "Your account has been deactivated. Contact your admin.",
  TENANT_SLUG_TAKEN: "This company slug is already taken.",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists.",
  TRANSITION_CONFLICT:
    "This workflow was updated by another user. Please refresh and try again.",
  TRANSITION_RULES_FAILED:
    "This transition could not be executed because one or more rules failed.",
  TRANSITION_ROLE_FORBIDDEN:
    "You don't have permission to perform this action.",
  COMMENT_REQUIRED: "A comment is required for this transition.",
  WORKFLOW_DEFINITION_NOT_DRAFT: "Only draft workflows can be modified.",
  MAX_USERS_REACHED:
    "You have reached the maximum number of users for your plan.",
  MAX_WORKFLOWS_REACHED:
    "You have reached the maximum number of workflows for your plan.",
};

/** Extract a user-friendly error message from an API error response */
export function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (error as any).response?.data;
    if (resp?.errorCode && errorMessages[resp.errorCode]) {
      return errorMessages[resp.errorCode];
    }
    if (resp?.message) return resp.message;
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}
