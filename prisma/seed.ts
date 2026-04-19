/**
 * `prisma/seed.ts` only clears the DB.
 *
 * The actual demo dataset — drivers, HOS posture, the 5 baseline active
 * trips (3 healthy, 1 breakdown, 1 ETA slip) — is produced at runtime by
 * `src/server/integrations/navpro-synthetic.ts` and written into the
 * `ActiveTripMirror` on boot by `src/server/runtime/demo-runtime.ts`.
 *
 * That split exists because the demo needs time-relative data (trip ETAs
 * anchored to `nowMs()`, drafts whose createdAt lines up with the live
 * clock, etc.), so materialising it at seed time would go stale between
 * dev server restarts. Running `prisma db seed` here just wipes any
 * leftover rows; the next API request re-seeds everything from the
 * synthetic layer.
 *
 * If you want to change what appears on boot, edit:
 *   - `driverBlueprints` and `getBaseTrips` in `navpro-synthetic.ts`
 *     (drivers, HOS, active trips)
 *   - `draftIntervention` in
 *     `src/features/monitoring/server/draft-intervention.ts`
 *     (alert copy styles — one per trigger kind)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.engineShowcaseDriver.deleteMany();
  await prisma.engineShowcaseScenario.deleteMany();
  await prisma.decisionLog.deleteMany();
  await prisma.loadAssignment.deleteMany();
  await prisma.interventionDraft.deleteMany();
  await prisma.activeTripMirror.deleteMany();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
