import { z } from 'zod';

export const FieldTypeEnum = z.enum([
  'TEXT',
  'TEXTAREA',
  'SELECT',
  'RADIO',
  'CHECKBOX',
]);

export const CreateSurveyFieldSchema = z.object({
  label: z
    .string()
    .min(1, 'Формулировка вопроса обязательна')
    .min(2, 'Слишком короткий текст вопроса'),
  type: FieldTypeEnum,
  required: z.boolean().default(false),
  order: z.number().int().nonnegative('Порядок должен быть неотрицательным числом'),
  options: z.array(z.string()).optional().nullable(),
});

export const UpdateSurveyFieldSchema = CreateSurveyFieldSchema.partial();

export type CreateSurveyFieldDto = z.infer<typeof CreateSurveyFieldSchema>;
export type UpdateSurveyFieldDto = z.infer<typeof UpdateSurveyFieldSchema>;