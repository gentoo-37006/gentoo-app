import type { AppStateStatus } from 'react-native';

/**
 * How long the app may stay inactive before the OpMode is stopped. iOS reports
 * `inactive` for a moment during a screenshot, and while Control Center, the
 * notification shade or a system dialog covers the app.
 */
export const INACTIVE_STOP_DELAY_MS = 2_000;

type StopTarget = {
  setControllerEnabled(enabled: boolean): void;
  stopOpMode(): void;
};

/**
 * Decides when leaving the foreground stops the OpMode.
 *
 * Backgrounding (or any state that is neither active nor inactive) stops it at
 * once. A brief inactive state only neutralizes the gamepads; the OpMode is
 * stopped if the app has not become active again after `delayMs`.
 */
export function createAppStateStop(client: StopTarget, delayMs = INACTIVE_STOP_DELAY_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    handle(state: AppStateStatus) {
      if (state === 'active') {
        cancel();
        return;
      }
      client.setControllerEnabled(false);
      if (state === 'inactive') {
        // A second inactive event does not extend the wait.
        timer ??= setTimeout(() => {
          timer = null;
          client.stopOpMode();
        }, delayMs);
        return;
      }
      cancel();
      client.stopOpMode();
    },
    /** Cancels a pending stop (the caller is tearing the Driver Station down itself). */
    dispose: cancel,
  };
}
