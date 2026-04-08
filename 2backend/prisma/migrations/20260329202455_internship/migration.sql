/*
  Warnings:

  - Changed the type of `internshipType` on the `InternshipRequest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `workMode` on the `InternshipRequest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "InternshipRequest" DROP COLUMN "internshipType",
ADD COLUMN     "internshipType" TEXT NOT NULL,
DROP COLUMN "workMode",
ADD COLUMN     "workMode" TEXT NOT NULL;

-- DropEnum
DROP TYPE "InternshipType";

-- DropEnum
DROP TYPE "WorkMode";
