-- AlterEnum
ALTER TYPE "FieldType" ADD VALUE 'CHECKBOX';

-- AlterTable
ALTER TABLE "SurveyField" ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT false;
