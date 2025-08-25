-- AlterTable
ALTER TABLE "public"."Rating" ADD COLUMN     "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "rating_deviation" INTEGER NOT NULL DEFAULT 350,
ADD COLUMN     "volatility" DECIMAL(65,30) NOT NULL DEFAULT 0.06;
