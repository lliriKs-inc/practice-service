import type {
  AuditLogger,
} from "../logger";
import type {
  AuthorizedFileDownload,
  FileAccessPolicy,
  FileAccessRequest,
} from "./file-access.policy";

export class AuditedFileAccessPolicy
  implements FileAccessPolicy
{
  constructor(
    private readonly policy: FileAccessPolicy,
    private readonly audit: AuditLogger
  ) {}

  async authorize(
    request: FileAccessRequest
  ): Promise<AuthorizedFileDownload | null> {
    try {
      const authorization =
        await this.policy.authorize(request);

      if (!authorization) {
        this.audit.record({
          action: "FILE_DOWNLOAD_DENIED",
          outcome: "denied",
          actorId: request.actor.id,
          requestId: request.requestId,
          resourceType: "stored-file",
          resourceId: request.key,
          metadata: {
            reason: "policy_denied",
          },
        });

        return null;
      }

      this.audit.record({
        action: "FILE_DOWNLOAD_GRANTED",
        outcome: "success",
        actorId: request.actor.id,
        requestId: request.requestId,
        resourceType: "stored-file",
        resourceId: request.key,
        metadata: {
          disposition:
            authorization.disposition ??
            "attachment",
          contentType:
            authorization.contentType,
        },
      });

      return authorization;
    } catch (error) {
      this.audit.record({
        action: "FILE_DOWNLOAD_DENIED",
        outcome: "failure",
        actorId: request.actor.id,
        requestId: request.requestId,
        resourceType: "stored-file",
        resourceId: request.key,
        metadata: {
          reason: "policy_failure",
          error,
        },
      });

      throw error;
    }
  }
}

