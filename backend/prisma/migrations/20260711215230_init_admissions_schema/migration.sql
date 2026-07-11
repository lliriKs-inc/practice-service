/*
  Warnings:

  - You are about to drop the column `cohort_id` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `review_comment` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `role_id` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `field_id` on the `ApplicationAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `ApplicationAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Cohort` table. All the data in the column will be lost.
  - You are about to drop the column `cohort_id` on the `TestTask` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `TestTask` table. All the data in the column will be lost.
  - You are about to drop the `CohortRole` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudentDocumentData` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SurveyField` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskCard` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[user_id,track_id]` on the table `Application` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[application_id,question_id]` on the table `ApplicationAnswer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[track_id]` on the table `TestTask` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `track_id` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `answer_value` to the `ApplicationAnswer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question_id` to the `ApplicationAnswer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_by` to the `Cohort` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Cohort` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `TestTask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `track_id` to the `TestTask` table without a default value. This is not possible if the table is not empty.
  - Added the required column `full_name` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INDIVIDUAL_TASK', 'TITLE_PAGE', 'REVIEW', 'NOTICE');

-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_cohort_id_fkey";

-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_role_id_fkey";

-- DropForeignKey
ALTER TABLE "ApplicationAnswer" DROP CONSTRAINT "ApplicationAnswer_application_id_fkey";

-- DropForeignKey
ALTER TABLE "ApplicationAnswer" DROP CONSTRAINT "ApplicationAnswer_field_id_fkey";

-- DropForeignKey
ALTER TABLE "CohortRole" DROP CONSTRAINT "CohortRole_cohort_id_fkey";

-- DropForeignKey
ALTER TABLE "StudentDocumentData" DROP CONSTRAINT "StudentDocumentData_cohort_id_fkey";

-- DropForeignKey
ALTER TABLE "StudentDocumentData" DROP CONSTRAINT "StudentDocumentData_user_id_fkey";

-- DropForeignKey
ALTER TABLE "SurveyField" DROP CONSTRAINT "SurveyField_cohort_id_fkey";

-- DropForeignKey
ALTER TABLE "TaskCard" DROP CONSTRAINT "TaskCard_cohort_id_fkey";

-- DropForeignKey
ALTER TABLE "TaskCard" DROP CONSTRAINT "TaskCard_user_id_fkey";

-- DropForeignKey
ALTER TABLE "TestTask" DROP CONSTRAINT "TestTask_cohort_id_fkey";

-- DropIndex
DROP INDEX "Application_user_id_cohort_id_key";

-- DropIndex
DROP INDEX "ApplicationAnswer_application_id_field_id_key";

-- DropIndex
DROP INDEX "Cohort_name_key";

-- AlterTable
ALTER TABLE "Application" DROP COLUMN "cohort_id",
DROP COLUMN "created_at",
DROP COLUMN "review_comment",
DROP COLUMN "role_id",
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "track_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ApplicationAnswer" DROP COLUMN "field_id",
DROP COLUMN "value",
ADD COLUMN     "answer_value" TEXT NOT NULL,
ADD COLUMN     "question_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Cohort" DROP COLUMN "name",
ADD COLUMN     "created_by" TEXT NOT NULL,
ADD COLUMN     "status" "CohortStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "application_start" DROP NOT NULL,
ALTER COLUMN "application_end" DROP NOT NULL,
ALTER COLUMN "practice_start" SET DATA TYPE DATE,
ALTER COLUMN "practice_end" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "TestTask" DROP COLUMN "cohort_id",
DROP COLUMN "content",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "file_url" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "track_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "full_name" TEXT NOT NULL;

-- DropTable
DROP TABLE "CohortRole";

-- DropTable
DROP TABLE "StudentDocumentData";

-- DropTable
DROP TABLE "SurveyField";

-- DropTable
DROP TABLE "TaskCard";

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "order_index" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestTaskSubmission" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestTaskSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "generated_file_url" TEXT,
    "generated_at" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFieldValue" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "filled_by" "UserRole" NOT NULL,

    CONSTRAINT "DocumentFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTask" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "task_date" DATE NOT NULL,
    "description" TEXT,
    "saved_at" TIMESTAMP(3),

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTaskLink" (
    "id" TEXT NOT NULL,
    "daily_task_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "DailyTaskLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_cohort_id_key" ON "Invitation"("cohort_id");

-- CreateIndex
CREATE UNIQUE INDEX "Survey_cohort_id_key" ON "Survey"("cohort_id");

-- CreateIndex
CREATE UNIQUE INDEX "Track_cohort_id_title_key" ON "Track"("cohort_id", "title");

-- CreateIndex
CREATE UNIQUE INDEX "TestTaskSubmission_application_id_key" ON "TestTaskSubmission"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "Report_application_id_key" ON "Report"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "Document_application_id_type_key" ON "Document"("application_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFieldValue_document_id_field_key_key" ON "DocumentFieldValue"("document_id", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTask_application_id_task_date_key" ON "DailyTask"("application_id", "task_date");

-- CreateIndex
CREATE UNIQUE INDEX "Application_user_id_track_id_key" ON "Application"("user_id", "track_id");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAnswer_application_id_question_id_key" ON "ApplicationAnswer"("application_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "TestTask_track_id_key" ON "TestTask"("track_id");

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestTask" ADD CONSTRAINT "TestTask_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestTaskSubmission" ADD CONSTRAINT "TestTaskSubmission_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFieldValue" ADD CONSTRAINT "DocumentFieldValue_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTaskLink" ADD CONSTRAINT "DailyTaskLink_daily_task_id_fkey" FOREIGN KEY ("daily_task_id") REFERENCES "DailyTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
