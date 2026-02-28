-- CreateTable
CREATE TABLE "ListingDailyMetrics" (
    "id" TEXT NOT NULL,
    "listingId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "viewsTotal" INTEGER NOT NULL DEFAULT 0,
    "viewsUnique" INTEGER NOT NULL DEFAULT 0,
    "inquiriesTotal" INTEGER NOT NULL DEFAULT 0,
    "conversationsStarted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingDailyMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingViewDailyUnique" (
    "id" TEXT NOT NULL,
    "listingId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingViewDailyUnique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingDailyMetrics_listingId_date_key" ON "ListingDailyMetrics"("listingId", "date");

-- CreateIndex
CREATE INDEX "ListingDailyMetrics_date_idx" ON "ListingDailyMetrics"("date");

-- CreateIndex
CREATE INDEX "ListingDailyMetrics_listingId_date_idx" ON "ListingDailyMetrics"("listingId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ListingViewDailyUnique_listingId_date_visitorHash_key" ON "ListingViewDailyUnique"("listingId", "date", "visitorHash");

-- CreateIndex
CREATE INDEX "ListingViewDailyUnique_listingId_date_idx" ON "ListingViewDailyUnique"("listingId", "date");

-- AddForeignKey
ALTER TABLE "ListingDailyMetrics" ADD CONSTRAINT "ListingDailyMetrics_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingViewDailyUnique" ADD CONSTRAINT "ListingViewDailyUnique_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
