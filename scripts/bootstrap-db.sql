PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS "DecisionLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actionType" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "mathSummary" TEXT,
  "outcome" TEXT NOT NULL,
  "tripId" TEXT,
  "driverId" INTEGER,
  "deadheadSavedMi" REAL,
  "revenueRecoveredUsd" REAL,
  "timeSavedMin" REAL,
  "entityType" TEXT,
  "source" TEXT
);

CREATE TABLE IF NOT EXISTS "LoadAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  "profitDeltaUsd" REAL
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoadAssignment_tripId_key" ON "LoadAssignment" ("tripId");

CREATE TABLE IF NOT EXISTS "ActiveTripMirror" (
  "tripId" TEXT NOT NULL PRIMARY KEY,
  "driverId" INTEGER NOT NULL,
  "loadId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "lastSeenAt" DATETIME NOT NULL,
  "etaMs" BIGINT NOT NULL,
  "currentLat" REAL NOT NULL,
  "currentLng" REAL NOT NULL,
  "scenarioOverride" TEXT,
  "plannedRouteJson" TEXT,
  "sourceUpdatedAt" DATETIME,
  "overrideReason" TEXT
);

CREATE TABLE IF NOT EXISTS "InterventionDraft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tripId" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "customerSms" TEXT NOT NULL,
  "relayDriverId" INTEGER,
  "relayDriverName" TEXT,
  "relayDistanceMi" REAL,
  "rerouteNeeded" BOOLEAN NOT NULL,
  "voiceScript" TEXT NOT NULL,
  "executedAt" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'drafted',
  "matchedCommand" TEXT,
  "audioSource" TEXT
);

CREATE INDEX IF NOT EXISTS "InterventionDraft_tripId_createdAt_idx" ON "InterventionDraft" ("tripId", "createdAt");

CREATE TABLE IF NOT EXISTS "EngineShowcaseScenario" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "title" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "loadJson" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "EngineShowcaseDriver" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scenarioId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "displayOrder" INTEGER NOT NULL,
  "driverId" INTEGER NOT NULL,
  "driverName" TEXT NOT NULL,
  "homeBase" TEXT NOT NULL,
  "currentMarket" TEXT NOT NULL,
  "hosRemainingMin" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,
  "signalsJson" TEXT NOT NULL,
  CONSTRAINT "EngineShowcaseDriver_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "EngineShowcaseScenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EngineShowcaseDriver_scenarioId_displayOrder_idx" ON "EngineShowcaseDriver" ("scenarioId", "displayOrder");
