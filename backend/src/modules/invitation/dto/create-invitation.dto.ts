import { z } from "zod";

export const createInvitationSchema = z.object({
  cohort_id: z.string().trim().min(1),
  expires_in_days: z.coerce.number().int().positive().default(7),
});

export const validateInvitationSchema = z.object({ token: z.string().trim().min(1) });
export type CreateInvitationDto = z.infer<typeof createInvitationSchema>;
