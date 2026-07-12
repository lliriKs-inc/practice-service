import type {
  Logger,
} from "./logger.types";
import type {
  AuditEvent,
  AuditLogger,
} from "./audit.types";

export class StructuredAuditLogger
  implements AuditLogger
{
  constructor(
    private readonly logger: Logger
  ) {}

  record(event: AuditEvent): void {
    const context = {
      audit: true,
      action: event.action,
      outcome: event.outcome,
      actorId: event.actorId,
      requestId: event.requestId,
      resource: {
        type: event.resourceType,
        id: event.resourceId,
      },
      metadata: event.metadata ?? {},
    };

    if (
      event.outcome === "denied" ||
      event.outcome === "failure"
    ) {
      this.logger.warn(
        "Security audit event",
        context
      );

      return;
    }

    this.logger.info(
      "Security audit event",
      context
    );
  }
}
