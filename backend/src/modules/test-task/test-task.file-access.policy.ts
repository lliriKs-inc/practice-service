import type {
  AuthorizedFileDownload,
  FileAccessPolicy,
  FileAccessRequest,
} from "../../shared/storage";
import { TestTaskService, type TestTaskActor } from "./test-task.service";

export class TestTaskFileAccessPolicy implements FileAccessPolicy {
  constructor(private readonly service: TestTaskService) {}

  authorize(
    request: FileAccessRequest,
  ): Promise<AuthorizedFileDownload | null> {
    const actor: TestTaskActor = {
      id: request.actor.id,
      role: request.actor.role,
    };
    return this.service.authorizeFile(actor, request.key);
  }
}
