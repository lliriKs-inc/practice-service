-- AlterTable
ALTER TABLE "TestTask"
ADD COLUMN "file_name" TEXT,
ADD COLUMN "file_content_type" TEXT;

-- AlterTable
ALTER TABLE "TestTaskSubmission"
ADD COLUMN "file_name" TEXT,
ADD COLUMN "file_content_type" TEXT;
