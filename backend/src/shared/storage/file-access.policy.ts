import { UserRole } from "@prisma/client";

export interface FileAccessActor {
  id: string;
  role: UserRole;
}

export type FileDisposition =
  | "attachment"
  | "inline";

export interface FileAccessRequest {
  actor: FileAccessActor;
  key: string;
  requestId: string | null;
}

export interface AuthorizedFileDownload {
  downloadName: string;
  contentType: string;
  disposition?: FileDisposition;
}

export interface FileAccessPolicy {
  authorize(
    request: FileAccessRequest
  ): Promise<AuthorizedFileDownload | null>;
}