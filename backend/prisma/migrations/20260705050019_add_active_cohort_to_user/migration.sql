-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active_cohort_id" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_active_cohort_id_fkey" FOREIGN KEY ("active_cohort_id") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
