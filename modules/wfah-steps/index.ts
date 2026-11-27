import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * Android step counter (TYPE_STEP_COUNTER) for walks, app 1.0.3.
 * See android/src/main/java/org/walkforahero/steps/WfahStepsModule.kt.
 * Optional on purpose: iOS (which uses CMPedometer in
 * wfah-background-activity), Expo Go and the test runner have no module.
 */
type Native = {
  isAvailable(): boolean;
  start(reset: boolean): boolean;
  stop(): void;
  flush(): boolean;
  samples(): number[][];
};

const native = Platform.OS === "android" ? requireOptionalNativeModule<Native>("WfahSteps") : null;

export function androidStepsAvailable(): boolean {
  try {
    return !!native?.isAvailable();
  } catch {
    return false;
  }
}

export function androidStepsStart(reset: boolean): boolean {
  try {
    return !!native?.start(reset);
  } catch {
    return false;
  }
}

export function androidStepsStop() {
  try {
    native?.stop();
  } catch {
    /* never block stopping a walk */
  }
}

export function androidStepsFlush() {
  try {
    native?.flush();
  } catch {
    /* optional */
  }
}

/** [[epochMs, cumulativeStepsSinceBoot], ...] oldest first. */
export function androidStepSamples(): number[][] {
  try {
    return native?.samples() ?? [];
  } catch {
    return [];
  }
}
