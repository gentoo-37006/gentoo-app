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
