import { z } from 'zod';

export const CreateApplicationAnswerSchema = z.object({
  field_id: z.string().min(1, 'Идентификатор поля анкеты обязателен'),
  value: z.string().min(1, 'Ответ не может быть пустым'),
});

export const CreateApplicationSchema = z.object({
  answers: z
    .array(CreateApplicationAnswerSchema)
    .min(1, 'Заявка должна содержать хотя бы один ответ на анкету'),
});

export type CreateApplicationDto = z.infer<typeof CreateApplicationSchema>;