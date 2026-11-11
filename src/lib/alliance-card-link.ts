import { Platform, Share } from 'react-native';
import { WEB_APP_URL } from '@/lib/env';
import { allianceCardUrl } from '@/lib/alliance-card';

/**
 * The link a partner opens. The web app uses its own origin, so a card made on
 * the beta site is opened on the beta site; native builds have no origin and
 * use the production one.
 */
export function cardLink(team: number): string {
  const origin =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : WEB_APP_URL;
  return allianceCardUrl(origin, team);
}

export type ShareOutcome = 'copied' | 'shared' | 'failed';

/** Web copies the link. Native opens the share sheet, which has Copy in it too. */
export async function shareCardLink(url: string): Promise<ShareOutcome> {
  try {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(url);
      return 'copied';
    }
    await Share.share({ message: url });
    return 'shared';
  } catch {
    return 'failed';
  }
}
