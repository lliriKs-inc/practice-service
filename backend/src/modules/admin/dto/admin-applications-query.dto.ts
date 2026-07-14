import { z } from "zod";

const optionalIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .optional();

export const adminApplicationsQuerySchema = z.object({
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED"])
    .optional(),
  trackId: optionalIdentifier,
  search: z.string().trim().min(1).max(200).optional(),
});

export type AdminApplicationsQuery = z.infer<
  typeof adminApplicationsQuerySchema
>;
