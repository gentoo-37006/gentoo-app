import { TeamInfo } from "../types";

const API_BASE = 'https://api.ftcscout.org/rest/v1';
const GRAPHQL_ENDPOINT = 'https://api.ftcscout.org/graphql'
const CHUNK_SIZE = 15
/**
 * The FTC season an event belongs to. Seasons are labelled by the year they
 * start and roll over in September — the 2025 season runs Sept 2025 to Apr
 * 2026 — so this has to be derived, not pinned, or every sync breaks the
 * moment kickoff moves the season on.
 */
export function currentSeason(now: Date = new Date()): number {
  // getMonth() is zero-based: 8 is September.
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/** Event metadata returned by FTCScout's REST event endpoint. */
export interface FTCScoutEvent {
  season: number;
  code: string;
  name: string;
  start: string | null;
  end: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export async function getEventDetails(eventCode: string, season: number): Promise<FTCScoutEvent> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}/events/${season}/${encodeURIComponent(eventCode)}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch event details for ${eventCode}: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request to FTC Scout API timed out (Event details).');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches the match schedule for a given FTC event.
 * @param eventCode e.g CAONCMP
 */
export async function getEventMatches(eventCode: string, season = currentSeason()): Promise<any> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}/events/${season}/${eventCode}/matches`, {
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
export async function getEventTeams(eventCode: string, season = currentSeason()): Promise<any> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}/events/${season}/${eventCode}/teams`, {
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

function generateBatchQuery(teamsChunk: TeamInfo[]) {
  const aliasFields = teamsChunk.map((team) => `
    team_${team.team_number}: teamByNumber(number: ${team.team_number}) {
      name
    }
  `).join('\n');

  return `query GetMultipleTeams { ${aliasFields} }`;
}

export async function populateTeamNames( teams: TeamInfo[]): Promise<TeamInfo[]> {
  const results: TeamInfo[] = [];

  for (let i = 0; i < teams.length; i += CHUNK_SIZE) {
    const chunk = teams.slice(i, i + CHUNK_SIZE);
    const query = generateBatchQuery(chunk);

    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const json = await response.json();
      if (json.errors) {
        console.error(`GraphQL Errors for chunk starting at index ${i}:`, json.errors);
      }

      const data = json.data || {};

      const updatedChunk: TeamInfo[] = chunk.map((team) => {
        const fetchedTeam = data[`team_${team.team_number}`];
        return {
          ...team,
          team_name: fetchedTeam?.name ?? team.team_name,
        };
      });

      results.push(...updatedChunk);
    } catch (error) {
      console.error(`Network error for chunk starting at index ${i}:`, error);
      results.push(...chunk);
    }
  }

  return results;
}
