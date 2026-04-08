/*
  Warnings:

  - Changed the type of `internshipType` on the `InternshipRequest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `workMode` on the `InternshipRequest` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "InternshipType" AS ENUM ('MANDATORY', 'VOLUNTARY', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- AlterTable
ALTER TABLE "InternshipRequest" DROP COLUMN "internshipType",
ADD COLUMN     "internshipType" "InternshipType" NOT NULL,
DROP COLUMN "workMode",
ADD COLUMN     "workMode" "WorkMode" NOT NULL;
