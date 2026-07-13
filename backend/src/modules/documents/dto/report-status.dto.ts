import { z } from "zod";

export const reportStatusSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
  })
  .strict();

export type ReportStatusDto = z.infer<
  typeof reportStatusSchema
>;
