import * as React from 'react';

/**
 * Bridge to the Electron shell's auto-updater, exposed by electron/preload.cjs.
 * `window.gentooDesktop` only exists inside the desktop app; everywhere else
 * (web, iOS, Android) the hook reports isDesktop=false and renders nothing.
 */

export type DesktopUpdateStatus = {
  state: 'idle' | 'checking' | 'downloading' | 'up-to-date' | 'downloaded' | 'error' | 'unsupported';
  version: string;
  next?: string | null;
  percent?: number;
  message?: string;
};

type GentooDesktop = {
  getUpdateState: () => Promise<DesktopUpdateStatus>;
  checkForUpdates: () => Promise<DesktopUpdateStatus>;
  installUpdate: () => Promise<void>;
  onUpdateStatus: (callback: (status: DesktopUpdateStatus) => void) => () => void;
};

declare global {
  interface Window {
    gentooDesktop?: GentooDesktop;
  }
}

const desktop = typeof window !== 'undefined' ? window.gentooDesktop : undefined;

export const isDesktopApp = !!desktop;

export function useDesktopUpdates() {
  const [status, setStatus] = React.useState<DesktopUpdateStatus | null>(null);

  React.useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    desktop.getUpdateState().then((s) => {
      if (!cancelled) setStatus(s);
    });
    const unsubscribe = desktop.onUpdateStatus(setStatus);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const check = React.useCallback(() => {
    void desktop?.checkForUpdates();
  }, []);

  const install = React.useCallback(() => {
    void desktop?.installUpdate();
  }, []);

  return { isDesktop: isDesktopApp, status, check, install };
}
