import { z } from "zod";

export const fieldTypeSchema = z.enum(["TEXT", "TEXTAREA", "SELECT", "RADIO", "CHECKBOX"]);

export const createSurveySchema = z.object({
  cohort_id: z.string().trim().min(1),
  title: z.string().trim().min(1),
});

export const updateSurveySchema = z.object({
  title: z.string().trim().min(1),
});

const questionFieldsSchema = z.object({
  label: z.string().trim().min(1),
  type: fieldTypeSchema,
  required: z.boolean().default(false),
  order_index: z.number().int().nonnegative().optional(),
  options: z.array(z.string().trim().min(1)).optional().nullable(),
});

export const createQuestionSchema = questionFieldsSchema.superRefine(validateQuestionOptions);

export const updateQuestionSchema = questionFieldsSchema.partial().superRefine(validateQuestionOptions);

export const reorderQuestionsSchema = z.object({
  question_ids: z.array(z.string().trim().min(1)).min(1),
});

export const copySurveySchema = z.object({
  target_cohort_id: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
});

function validateQuestionOptions(
  value: { type?: z.infer<typeof fieldTypeSchema>; options?: string[] | null },
  ctx: z.RefinementCtx,
) {
  if (!value.type) return;
  const choiceType = value.type === "SELECT" || value.type === "RADIO" || value.type === "CHECKBOX";
  if (choiceType && (!value.options || value.options.length === 0)) {
    ctx.addIssue({ code: "custom", path: ["options"], message: "Options are required for choice questions" });
  }
  if (!choiceType && value.options && value.options.length > 0) {
    ctx.addIssue({ code: "custom", path: ["options"], message: "Options are only valid for choice questions" });
  }
  if (value.options && new Set(value.options).size !== value.options.length) {
    ctx.addIssue({ code: "custom", path: ["options"], message: "Options must be unique" });
  }
}

export type CreateSurveyDto = z.infer<typeof createSurveySchema>;
export type CreateQuestionDto = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionDto = z.infer<typeof updateQuestionSchema>;
