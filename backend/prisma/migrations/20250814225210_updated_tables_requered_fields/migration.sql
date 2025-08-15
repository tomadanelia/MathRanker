/*
  Warnings:

  - Added the required column `category` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Made the column `ratingBucket` on table `Question` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ratings` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `stats` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."Category" AS ENUM ('Arithmetic', 'Algebra', 'Geometry', 'Mixed');

-- AlterTable
ALTER TABLE "public"."Question" DROP COLUMN "category",
ADD COLUMN     "category" "public"."Category" NOT NULL,
ALTER COLUMN "ratingBucket" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "ratings" SET NOT NULL,
ALTER COLUMN "ratings" SET DEFAULT '{"arithmetic": {"rating": 1200, "gamesPlayed": 0}, "algebra": {"rating": 1200, "gamesPlayed": 0}, "geometry": {"rating": 1200, "gamesPlayed": 0}, "mixed": {"rating": 1200, "gamesPlayed": 0}}',
ALTER COLUMN "stats" SET NOT NULL,
ALTER COLUMN "stats" SET DEFAULT '{"highestWinStreaks": {}, "winLossRecords": {}}';

-- CreateIndex
CREATE INDEX "Question_category_ratingBucket_idx" ON "public"."Question"("category", "ratingBucket");
