import { getFlags } from "@/config/flags";
import { clearDemoPersistence } from "@/features/demo/server/reset-demo-state";

declare global {
  // eslint-disable-next-line no-var
  var __coDispatchDemoRuntimeReady__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __coDispatchDemoRuntimePromise__: Promise<void> | undefined;
}

function shouldResetSyntheticDemoOnBoot() {
  const flags = getFlags();
  return flags.useSyntheticNavPro || flags.useNavProMock || !flags.hasLiveNavPro;
}

export async function ensureDemoRuntimeReady() {
  if (!shouldResetSyntheticDemoOnBoot()) {
    global.__coDispatchDemoRuntimeReady__ = true;
    return;
  }

  if (global.__coDispatchDemoRuntimeReady__) {
    return;
  }

  if (!global.__coDispatchDemoRuntimePromise__) {
    global.__coDispatchDemoRuntimePromise__ = clearDemoPersistence().then(() => {
      global.__coDispatchDemoRuntimeReady__ = true;
    });
  }

  await global.__coDispatchDemoRuntimePromise__;
}

export function resetDemoRuntimeForTests() {
  global.__coDispatchDemoRuntimeReady__ = false;
  global.__coDispatchDemoRuntimePromise__ = undefined;
}
