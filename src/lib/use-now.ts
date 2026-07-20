import * as React from 'react';

/**
 * Time snapshot that re-renders every `intervalMs` (default: once a minute).
 * Use instead of calling Date.now() during render, which the React Compiler
 * forbids — and unlike a render-time call, this keeps long-lived screens
 * (kiosk dashboards at competition) ticking over.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
