/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `ratings` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."AnswerStatus" AS ENUM ('Correct', 'Incorrect', 'Skipped');

-- AlterTable
ALTER TABLE "public"."Question" DROP COLUMN "createdAt";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "ratings";

-- CreateTable
CREATE TABLE "public"."Rating" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "public"."Category" NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GameHistory" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "public"."Category" NOT NULL,
    "timeControl" TEXT NOT NULL,
    "playerAId" TEXT,
    "playerARatingBefore" INTEGER NOT NULL,
    "playerARatingAfter" INTEGER NOT NULL,
    "playerBId" TEXT,
    "playerBRatingBefore" INTEGER NOT NULL,
    "playerBRatingAfter" INTEGER NOT NULL,
    "winnerId" TEXT,

    CONSTRAINT "GameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GameMove" (
    "id" SERIAL NOT NULL,
    "gameHistoryId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "public"."AnswerStatus" NOT NULL,
    "pointsGained" INTEGER NOT NULL DEFAULT 0,
    "answerGiven" TEXT,
    "timeTakenMs" INTEGER NOT NULL,

    CONSTRAINT "GameMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_userId_category_key" ON "public"."Rating"("userId", "category");

-- AddForeignKey
ALTER TABLE "public"."Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameHistory" ADD CONSTRAINT "GameHistory_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameHistory" ADD CONSTRAINT "GameHistory_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameMove" ADD CONSTRAINT "GameMove_gameHistoryId_fkey" FOREIGN KEY ("gameHistoryId") REFERENCES "public"."GameHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GameMove" ADD CONSTRAINT "GameMove_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
