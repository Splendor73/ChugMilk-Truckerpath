-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "mathSummary" TEXT,
    "outcome" TEXT NOT NULL,
    "tripId" TEXT,
    "driverId" INTEGER,
    "deadheadSavedMi" DOUBLE PRECISION,
    "revenueRecoveredUsd" DOUBLE PRECISION,
    "timeSavedMin" DOUBLE PRECISION,
    "entityType" TEXT,
    "source" TEXT,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "driverId" INTEGER NOT NULL,
    "loadId" TEXT NOT NULL,
    "returnLoadId" TEXT,
    "tripId" TEXT NOT NULL,
    "returnTripId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "scoreSnapshotJson" TEXT,
    "assignedBy" TEXT NOT NULL DEFAULT 'copilot-ui',
    "navProPayloadJson" TEXT,
    "backhaulNarrative" TEXT,
    "profitDeltaUsd" DOUBLE PRECISION,

    CONSTRAINT "LoadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveTripMirror" (
    "tripId" TEXT NOT NULL,
    "driverId" INTEGER NOT NULL,
    "loadId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "etaMs" BIGINT NOT NULL,
    "currentLat" DOUBLE PRECISION NOT NULL,
    "currentLng" DOUBLE PRECISION NOT NULL,
    "scenarioOverride" TEXT,
    "plannedRouteJson" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "overrideReason" TEXT,

    CONSTRAINT "ActiveTripMirror_pkey" PRIMARY KEY ("tripId")
);

-- CreateTable
CREATE TABLE "InterventionDraft" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tripId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "customerSms" TEXT NOT NULL,
    "relayDriverId" INTEGER,
    "relayDriverName" TEXT,
    "relayDistanceMi" DOUBLE PRECISION,
    "rerouteNeeded" BOOLEAN NOT NULL,
    "voiceScript" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'drafted',
    "matchedCommand" TEXT,
    "audioSource" TEXT,

    CONSTRAINT "InterventionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineShowcaseScenario" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "loadJson" TEXT NOT NULL,

    CONSTRAINT "EngineShowcaseScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineShowcaseDriver" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "displayOrder" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "driverName" TEXT NOT NULL,
    "homeBase" TEXT NOT NULL,
    "currentMarket" TEXT NOT NULL,
    "hosRemainingMin" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "signalsJson" TEXT NOT NULL,

    CONSTRAINT "EngineShowcaseDriver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoadAssignment_tripId_key" ON "LoadAssignment"("tripId");

-- CreateIndex
CREATE INDEX "InterventionDraft_tripId_createdAt_idx" ON "InterventionDraft"("tripId", "createdAt");

-- CreateIndex
CREATE INDEX "EngineShowcaseDriver_scenarioId_displayOrder_idx" ON "EngineShowcaseDriver"("scenarioId", "displayOrder");

-- AddForeignKey
ALTER TABLE "EngineShowcaseDriver" ADD CONSTRAINT "EngineShowcaseDriver_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "EngineShowcaseScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
