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
