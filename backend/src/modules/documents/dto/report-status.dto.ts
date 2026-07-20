import { z } from "zod";

export const reportStatusSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().trim().min(1).max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "REJECTED" && !value.rejectionReason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "Rejection reason is required" });
    }
    if (value.status === "APPROVED" && value.rejectionReason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "Rejection reason is allowed only for rejected report" });
    }
  })
  .strict();

export type ReportStatusDto = z.infer<
  typeof reportStatusSchema
>;
