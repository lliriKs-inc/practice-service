-- AlterTable
ALTER TABLE "User" ADD COLUMN "active_application_id" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_active_application_id_fkey"
  FOREIGN KEY ("active_application_id") REFERENCES "Application"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
