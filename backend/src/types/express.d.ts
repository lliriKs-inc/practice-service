import { UserRole } from "@prisma/client";
import type { SaveFileInput } from "../shared/storage";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };

      cohortId?: string | null;
      requestId?: string;
      storageUpload?: SaveFileInput;
    }
  }
}

export {};