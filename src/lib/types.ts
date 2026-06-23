/**
 * App-level types mirroring the Supabase schema. Kept hand-written (instead of
 * generated) and extended per feature phase.
 */

export type UserRole = 'admin' | 'member';
export type UserStatus = 'pending' | 'approved' | 'rejected';

/** Non-gating roles used for routing assignments and notifications. */
export type FunctionalRole = 'scouter' | 'strategist' | 'pit';

export const FUNCTIONAL_ROLES: { value: FunctionalRole; label: string }[] = [
  { value: 'scouter', label: 'Scouter' },
  { value: 'strategist', label: 'Strategist' },
  { value: 'pit', label: 'Pit crew' },
];

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  functional_roles: FunctionalRole[];
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

export type NotificationType =
  | 'talkie_request'
  | 'talkie_claimed'
  | 'talkie_resolved'
  | 'match_report'
  | 'assignment'
  | 'approval'
  | 'task'
  | 'general';

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

// ---- Scouting ---------------------------------------------------------------

export type AnswerValue = 'yes' | 'no' | 'did_not_see';

export type ScoutedTeam = {
  id: string;
  team_number: number;
  team_name: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CapabilityQuestion = {
  id: string;
  prompt: string;
  category: string;
  weight: number;
  sort_order: number;
  active: boolean;
  created_at: string;
};

/** Row from the team_scores view. */
export type TeamScore = {
  team_id: string;
  team_number: number;
  team_name: string | null;
  score: number;
  entry_count: number;
};

export type PitEntry = {
  id: string;
  scouted_team_id: string;
  scouter_id: string | null;
  notes: string | null;
  created_at: string;
};

export type PitAnswer = {
  id: string;
  entry_id: string;
  question_id: string;
  answer: AnswerValue;
};

// ---- Match scouting ---------------------------------------------------------

export type AssignmentStatus = 'assigned' | 'submitted';

export type Match = {
  id: string;
  match_number: number;
  label: string | null;
  scheduled_time: string | null;
  red1: number | null;
  red2: number | null;
  blue1: number | null;
  blue2: number | null;
  created_at: string;
};

export type ScoutingAssignment = {
  id: string;
  match_id: string;
  scouter_id: string;
  team_number: number | null;
  status: AssignmentStatus;
  assigned_by: string | null;
  created_at: string;
};

export type MatchReport = {
  id: string;
  assignment_id: string | null;
  match_id: string;
  scouter_id: string | null;
  team_number: number;
  rating: number | null;
  played_defense: boolean;
  notes: string | null;
  created_at: string;
};

/** Alliance team slots in display order. */
export function matchTeams(m: Match): { red: (number | null)[]; blue: (number | null)[] } {
  return { red: [m.red1, m.red2], blue: [m.blue1, m.blue2] };
}

/** Non-null team numbers in a match (red then blue). */
export function matchTeamNumbers(m: {
  red1: number | null;
  red2: number | null;
  blue1: number | null;
  blue2: number | null;
}): number[] {
  return [m.red1, m.red2, m.blue1, m.blue2].filter((n): n is number => n != null);
}

export function matchTitle(m: { label: string | null; match_number: number }): string {
  return m.label || `Match ${m.match_number}`;
}
