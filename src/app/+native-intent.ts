import { nativeAppPath } from '@/lib/app-links';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return nativeAppPath(path);
}
