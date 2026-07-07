import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/prisma'; 
import { CreateSurveyFieldDto, UpdateSurveyFieldDto } from './dto/survey.dto';

export class SurveyService {
  async createField(cohortId: string, dto: CreateSurveyFieldDto) {
    return prisma.surveyField.create({
      data: {
        label: dto.label,
        type: dto.type,
        order: dto.order,
        cohort_id: cohortId,
        options: dto.options === null ? Prisma.DbNull : dto.options,
      },
    });
  }

  async getAllFields(cohortId: string) {
    const fields = await prisma.surveyField.findMany({
      where: { cohort_id: cohortId },
      orderBy: { order: 'asc' },
    });
    
    return fields.map(field => ({
      ...field,
      options: field.options ?? null,
    }));
  }

  async getFieldById(id: string, cohortId: string) {
    const field = await prisma.surveyField.findFirst({
      where: { id, cohort_id: cohortId },
    });
    
    if (!field) return null;
    
    return {
      ...field,
      options: field.options ?? null,
    };
  }

  async updateField(id: string, cohortId: string, dto: UpdateSurveyFieldDto) {
    const exists = await prisma.surveyField.findFirst({
      where: { id, cohort_id: cohortId },
    });

    if (!exists) return null;

    return prisma.surveyField.update({
      where: { id },
      data: {
        label: dto.label,
        type: dto.type,
        order: dto.order,
        options: dto.options === null ? Prisma.DbNull : dto.options,
      },
    });
  }

  async deleteField(id: string, cohortId: string) {
    const exists = await prisma.surveyField.findFirst({
      where: { id, cohort_id: cohortId },
    });

    if (!exists) return null;

    return prisma.surveyField.delete({
      where: { id },
    });
  }
}