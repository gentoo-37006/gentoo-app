const API_BASE = 'https://api.ftcscout.org/rest/v1';
const SEASON = 2025;

/**
 * Fetches the match schedule for a given FTC event.
 * @param eventCode e.g., '2023-US-CA-LA'
 */
export async function getEventMatches(eventCode: string): Promise<any> {
  const res = await fetch(`${API_BASE}/events/${SEASON}/${eventCode}/matches`);
  if (!res.ok) {
    throw new Error(`Failed to fetch matches for event ${eventCode}: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetches the participating teams for a given FTC event.
 * @param eventCode e.g., '2023-US-CA-LA'
 */
export async function getEventTeams(eventCode: string): Promise<any> {
  const res = await fetch(`${API_BASE}/events/${SEASON}/${eventCode}/teams`);
  if (!res.ok) {
    throw new Error(`Failed to fetch teams for event ${eventCode}: ${res.statusText}`);
  }
  return res.json();
}
