import { z } from "zod";

const optionalIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .optional();

export const adminDocumentsQuerySchema = z.object({
  trackId: optionalIdentifier,
  studentId: optionalIdentifier,
  search: z.string().trim().min(1).max(200).optional(),
  reportStatus: z
    .enum(["MISSING", "PENDING", "APPROVED", "REJECTED"])
    .optional(),
  documentType: z
    .enum(["INDIVIDUAL_TASK", "TITLE_PAGE", "REVIEW", "NOTICE"])
    .optional(),
  readiness: z.enum(["READY", "INCOMPLETE"]).optional(),
});

export type AdminDocumentsQuery = z.infer<
  typeof adminDocumentsQuerySchema
>;
