import { config } from "../config";
import { StructuredAuditLogger } from "./audit.logger";
import { StructuredLogger } from "./structured.logger";

export const appLogger = new StructuredLogger({
  level: config.logging.level,
});

export const auditLogger =
  new StructuredAuditLogger(appLogger);
