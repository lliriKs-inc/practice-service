import type {
  LogContext,
} from "./logger.types";

export const AUDIT_ACTIONS = Object.freeze([
  "FILE_STORED",
  "FILE_REPLACED",
  "FILE_REMOVED",
  "FILE_DOWNLOAD_GRANTED",
  "FILE_DOWNLOAD_DENIED",
  "REPORT_STATUS_CHANGED",
  "APPLICATION_STATUS_CHANGED",
  "TEST_TASK_PUBLISHED",
] as const);

export type AuditAction =
  (typeof AUDIT_ACTIONS)[number];

export type AuditOutcome =
  | "success"
  | "denied"
  | "failure";

export interface AuditEvent {
  action: AuditAction;
  outcome: AuditOutcome;
  actorId: string | null;
  requestId: string | null;
  resourceType: string;
  resourceId: string;
  metadata?: LogContext;
}

export interface AuditLogger {
  record(event: AuditEvent): void;
}
