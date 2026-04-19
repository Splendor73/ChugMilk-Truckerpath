import { getFlags } from "@/config/flags";
import { clearDemoPersistence, seedActiveTripMirrorFromLive } from "@/features/demo/server/reset-demo-state";
import { createRepositories } from "@/server/repositories";

declare global {
  // eslint-disable-next-line no-var
  var __coDispatchDemoRuntimeReady__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __coDispatchDemoRuntimePromise__: Promise<void> | undefined;
}

function shouldBootstrapDemoData() {
  const flags = getFlags();
  return flags.useSyntheticNavPro || flags.useNavProMock || !flags.hasLiveNavPro;
}

// On serverless runtimes (Vercel) every Lambda cold start used to re-run
// `clearDemoPersistence`, which silently nuked intervention drafts, decision
// logs, and load assignments created by other instances. The alert feed
// would flash on screen and then disappear because a sibling Lambda had
// wiped the rows in the background. We now only seed the trip mirror when
// it is empty and never auto-wipe. Explicit resets still go through
// `/api/dev/simulate` with `action: "reset"`.
//
// `RESET_DEMO_ON_BOOT=true` restores the old destructive behavior for local
// dev when you really do want a clean slate every time `npm run dev` starts.
const shouldWipeOnBoot = process.env.RESET_DEMO_ON_BOOT === "true";

export async function ensureDemoRuntimeReady() {
  if (!shouldBootstrapDemoData()) {
    global.__coDispatchDemoRuntimeReady__ = true;
    return;
  }

  if (global.__coDispatchDemoRuntimeReady__) {
    return;
  }

  if (!global.__coDispatchDemoRuntimePromise__) {
    global.__coDispatchDemoRuntimePromise__ = (async () => {
      if (shouldWipeOnBoot) {
        await clearDemoPersistence();
      }
      const repositories = createRepositories();
      const existingTrips = await repositories.activeTripMirror.listAll();
      if (existingTrips.length === 0) {
        await seedActiveTripMirrorFromLive();
      }
      global.__coDispatchDemoRuntimeReady__ = true;
    })();
  }

  await global.__coDispatchDemoRuntimePromise__;
}

export function resetDemoRuntimeForTests() {
  global.__coDispatchDemoRuntimeReady__ = false;
  global.__coDispatchDemoRuntimePromise__ = undefined;
}
