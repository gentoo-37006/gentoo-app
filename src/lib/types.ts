/**
 * App-level types mirroring the Supabase schema. Kept hand-written (instead of
 * generated) and extended per feature phase.
 */

export type UserRole = 'admin' | 'member';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export type EventData = {
  event_code: string;
  data: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
};

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
  discord_id: string | null;
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

export type PicklistTier = 'tier1' | 'tier2' | 'tier3' | 'dnp';

export const PICKLIST_TIERS: { value: PicklistTier; label: string; short: string }[] = [
  { value: 'tier1', label: 'Tier 1', short: 'T1' },
  { value: 'tier2', label: 'Tier 2', short: 'T2' },
  { value: 'tier3', label: 'Tier 3', short: 'T3' },
  { value: 'dnp', label: 'Do not pick', short: 'DNP' },
];

/** Tier plus the bucket for teams that haven't been tiered yet. */
export type TierKey = PicklistTier | 'untiered';

export function tierLabel(key: TierKey): string {
  return key === 'untiered' ? 'Uncategorized' : PICKLIST_TIERS.find((t) => t.value === key)!.label;
}

export type ScoutedTeam = {
  id: string;
  team_number: number;
  team_name: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  picklist_tier: PicklistTier | null;
  picklist_rank: number | null;
  picklist_notes: string | null;
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
  red_score?: number | null;
  blue_score?: number | null;
  red_auto?: number | null;
  red_dc?: number | null;
  blue_auto?: number | null;
  blue_dc?: number | null;
  has_been_played?: boolean;
  tournament_level?: string | null;
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

// ---- Talkie -----------------------------------------------------------------

export type TalkieStatus = 'open' | 'claimed' | 'resolved';

export type TalkieRequest = {
  id: string;
  requester_id: string | null;
  team_number: number;
  reason: string;
  status: TalkieStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  response: string | null;
  resolved_at: string | null;
  created_at: string;
};

// ---- Projects & tasks -------------------------------------------------------

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'done';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
];

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Set when the project is moved to trash; null while active. */
  deleted_at: string | null;
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  /** Markdown body, edited on the task's own page. */
  notes: string | null;
  status: TaskStatus;
  assignee_ids: string[];
  /** Task this one waits on, set while status = 'blocked'. */
  blocked_by: string | null;
  /** Project this one waits on instead of an individual task. */
  blocked_by_project: string | null;
  due_date: string | null;
  priority: Priority;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// ---- Pit-duty schedule ------------------------------------------------------

export type PitShift = {
  id: string;
  start_time: string;
  end_time: string;
  assignee_id: string | null;
  generated: boolean;
  created_at: string;
};
