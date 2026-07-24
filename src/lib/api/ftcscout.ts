const API_BASE = 'https://api.ftcscout.org/rest/v1';
const SEASON = 2025;

/**
 * Fetches the match schedule for a given FTC event.
 * @param eventCode e.g CAONCMP
 */
export async function getEventMatches(eventCode: string): Promise<any> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}/events/${SEASON}/${eventCode}/matches`, {
      signal: controller.signal
    });
    clearTimeout(id);
    if (!res.ok) {
      throw new Error(`Failed to fetch matches for event ${eventCode}: ${res.statusText}`);
    }
    return res.json();
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw new Error('Request to FTC Scout API timed out (Matches).');
    throw err;
  }
}

/**
 * Fetches the participating teams for a given FTC event.
 * @param eventCode e.g CAONCMP
 */
export async function getEventTeams(eventCode: string): Promise<any> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}/events/${SEASON}/${eventCode}/teams`, {
      signal: controller.signal
    });
    clearTimeout(id);
    if (!res.ok) {
      throw new Error(`Failed to fetch teams for event ${eventCode}: ${res.statusText}`);
    }
    return res.json();
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw new Error('Request to FTC Scout API timed out (Teams).');
    throw err;
  }
}
