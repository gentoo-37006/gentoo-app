import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AnswerValue,
  AppNotification,
  CapabilityQuestion,
  Match,
  MatchReport,
  Part,
  PartCheckout,
  PicklistTier,
  PitAnswer,
  PitEntry,
  PitShift,
  Priority,
  Profile,
  Project,
  ProjectStatus,
  OfficialStats,
  ScoutedTeam,
  ScoutingAssignment,
  TalkieRequest,
  Task,
  TaskStatus,
  TeamScore,
} from '@/lib/types';
import type { ParsedMatch } from '@/lib/csv';
import type { GeneratedShift } from '@/lib/scheduler';
import { nextTaskSortOrder } from '@/lib/task-order';

const STORAGE_KEY = 'gentoo.demo.workspace.v3';
const AUTH_KEY = 'gentoo.demo.enabled.v1';

export const DEMO_USER_ID = 'demo-user';
const DEMO_ADMIN_ID = DEMO_USER_ID;
const DEMO_SCOUTER_ID = 'demo-scouter';
const DEMO_PIT_ID = 'demo-pit';
const DEMO_STRATEGIST_ID = 'demo-strategist';

let active = false;
let workspace: DemoWorkspace | null = null;

type DemoWorkspace = {
  profiles: Profile[];
  notifications: AppNotification[];
  capabilityQuestions: CapabilityQuestion[];
  scoutedTeams: ScoutedTeam[];
  pitEntries: PitEntry[];
  pitAnswers: PitAnswer[];
  matches: Match[];
  assignments: ScoutingAssignment[];
  matchReports: MatchReport[];
  talkieRequests: TalkieRequest[];
  projects: Project[];
  tasks: Task[];
  pitShifts: PitShift[];
  parts: Part[];
  checkouts: PartCheckout[];
  seededAt: string;
};

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

/**
 * Local calendar date N days out, e.g. "2026-07-28" — matching the `date`
 * columns Postgres returns for task due dates (daysFromNow gives a full
 * timestamp, which those columns never contain).
 */
function dateFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function daysFromNow(days: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function makeProfile(
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'functional_roles'>
): Profile {
  const timestamp = now();
  return {
    avatar_url: null,
    status: 'approved',
    discord_id: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...profile,
  };
}

const EMPTY_STANDINGS: OfficialStats = {
  official_rank: null,
  official_wins: null,
  official_losses: null,
  official_ties: null,
  official_avg_points: null,
};

/** Official standings for the seeded teams, as the FTC Scout sync would store. */
const DEMO_STANDINGS: OfficialStats[] = [
  { official_rank: 2, official_wins: 7, official_losses: 2, official_ties: 0, official_avg_points: 148.6 },
  { official_rank: 5, official_wins: 5, official_losses: 4, official_ties: 0, official_avg_points: 121.3 },
];

function seedWorkspace(): DemoWorkspace {
  const timestamp = now();
  const questions: CapabilityQuestion[] = [
    ['q-auto', 'Can score samples in autonomous?', 'Autonomous', 2],
    ['q-high', 'Can place specimens on the high chamber?', 'TeleOp', 3],
    ['q-climb', 'Can climb consistently?', 'Endgame', 3],
    ['q-drive', 'Has reliable drivetrain control?', 'Drive team', 2],
  ].map(([qid, prompt, category, weight], index) => ({
    id: qid as string,
    prompt: prompt as string,
    category: category as string,
    weight: weight as number,
    sort_order: index + 1,
    active: true,
    created_at: timestamp,
  }));

  const teams: ScoutedTeam[] = [
    ['team-11248', 11248, 'Gentoo Robotics', 'Fast cycle time; verify climb under defense.', 'tier1'],
    ['team-7244', 7244, 'Out of the Box', 'Great autonomous path, average endgame.', 'tier2'],
    ['team-3596', 3596, 'Circuit Breakers', 'Strong defense and consistent driver control.', 'tier2'],
  ].map(([teamId, number, name, notes, tier], index) => ({
    id: teamId as string,
    team_number: number as number,
    team_name: name as string,
    notes: null,
    created_by: DEMO_ADMIN_ID,
    created_at: timestamp,
    updated_at: timestamp,
    picklist_tier: tier as PicklistTier,
    picklist_rank: index + 1,
    picklist_notes: notes as string,
    // The last team hasn't played yet — its standings stay empty, the same as
    // a team added by hand before the FTC Scout sync sees it.
    ...(DEMO_STANDINGS[index] ?? EMPTY_STANDINGS),
    stats_synced_at: DEMO_STANDINGS[index] ? timestamp : null,
  }));

  const pitEntries: PitEntry[] = teams.map((team, index) => ({
    id: `pit-entry-${index + 1}`,
    scouted_team_id: team.id,
    scouter_id: [DEMO_ADMIN_ID, DEMO_SCOUTER_ID, DEMO_PIT_ID][index],
    notes: ['Clean wiring and compact intake.', 'Ask about spare slides.', 'Bring strategist to watch match 3.'][index],
    created_at: daysFromNow(-index, 13),
  }));

  const answerGrid: AnswerValue[][] = [
    ['yes', 'yes', 'yes', 'yes'],
    ['yes', 'yes', 'no', 'yes'],
    ['no', 'yes', 'did_not_see', 'yes'],
  ];
  const pitAnswers: PitAnswer[] = pitEntries.flatMap((entry, row) =>
    questions.map((q, col) => ({
      id: `pit-answer-${row + 1}-${col + 1}`,
      entry_id: entry.id,
      question_id: q.id,
      answer: answerGrid[row][col],
    }))
  );

  // Times are relative to the seed moment so the countdown and "my shifts"
  // cards always look alive; getDemoWorkspace() re-rolls stale workspaces.
  const matches: Match[] = [
    { id: 'match-1', match_number: 1, label: 'Qual 1', scheduled_time: hoursFromNow(0.75), red1: 11248, red2: 7244, blue1: 3596, blue2: 9915, created_at: timestamp },
    { id: 'match-2', match_number: 2, label: 'Qual 2', scheduled_time: hoursFromNow(1.75), red1: 7244, red2: 3596, blue1: 11248, blue2: 14133, created_at: timestamp },
    { id: 'match-3', match_number: 3, label: 'Qual 3', scheduled_time: hoursFromNow(2.75), red1: 9915, red2: 11248, blue1: 7244, blue2: 3596, created_at: timestamp },
  ];

  const assignments: ScoutingAssignment[] = [
    { id: 'assignment-1', match_id: 'match-1', scouter_id: DEMO_ADMIN_ID, team_number: 11248, status: 'assigned', assigned_by: DEMO_STRATEGIST_ID, created_at: timestamp },
    { id: 'assignment-2', match_id: 'match-2', scouter_id: DEMO_SCOUTER_ID, team_number: 7244, status: 'submitted', assigned_by: DEMO_STRATEGIST_ID, created_at: timestamp },
  ];

  const matchReports: MatchReport[] = [
    { id: 'report-1', assignment_id: 'assignment-2', match_id: 'match-2', scouter_id: DEMO_SCOUTER_ID, team_number: 7244, rating: 4, played_defense: false, notes: 'Clean autonomous and one missed cycle.', created_at: timestamp },
  ];

  const projects: Project[] = [
    { id: 'project-pit', name: 'Pit readiness', description: 'Prep the pit before inspection.', status: 'active', priority: 'high', sort_order: 10, created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp, deleted_at: null },
    { id: 'project-scouting', name: 'Scouting setup', description: 'Validate match schedule and roles.', status: 'planning', priority: 'medium', sort_order: 20, created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp, deleted_at: null },
  ];

  const tasks: Task[] = [
    { id: 'task-1', project_id: 'project-pit', title: 'Label battery cables', notes: '## Why\n\nInspectors flagged unlabeled leads last event.\n\n- [ ] Print labels\n- [ ] Wrap both ends\n- [ ] Photograph for the log', status: 'in_progress', assignee_ids: [DEMO_PIT_ID, DEMO_ADMIN_ID], blocked_by: null, blocked_by_project: null, due_date: dateFromNow(1), priority: 'high', tags: ['pit', 'electrical'], sort_order: 10, created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp, deleted_at: null },
    { id: 'task-2', project_id: 'project-pit', title: 'Charge driver station laptop', notes: null, status: 'blocked', assignee_ids: [DEMO_ADMIN_ID], blocked_by: 'task-1', blocked_by_project: null, due_date: dateFromNow(0), priority: 'urgent', tags: ['drive'], sort_order: 20, created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp, deleted_at: null },
    { id: 'task-3', project_id: 'project-scouting', title: 'Import qualification schedule', notes: null, status: 'todo', assignee_ids: [DEMO_STRATEGIST_ID], blocked_by: null, blocked_by_project: null, due_date: null, priority: 'medium', tags: ['scouting'], sort_order: 10, created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp, deleted_at: null },
  ];

  const parts: Part[] = [
    { id: 'part-motor', name: 'REV HD Hex Motor (40:1)', part_number: 'REV-41-1301', category: 'motor', location: 'Bin A2', notes: null, quantity: 8, consumable: false, unit: null, low_stock_at: 2, created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp },
    { id: 'part-servo', name: 'goBILDA Torque Servo', part_number: '2000-0025-0002', category: 'servo', location: 'Bin A3', notes: null, quantity: 6, consumable: false, unit: null, low_stock_at: 2, created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp },
    { id: 'part-hub', name: 'REV Control Hub', part_number: 'REV-31-1595', category: 'electronics', location: 'Shelf B', notes: 'Keep the spare flashed to the current firmware.', quantity: 2, consumable: false, unit: null, low_stock_at: null, created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp },
    { id: 'part-filament', name: 'PLA filament — black', part_number: null, category: 'material', location: 'Printer cart', notes: null, quantity: 1400, consumable: true, unit: 'g', low_stock_at: 500, created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp },
    { id: 'part-screws', name: 'M4 x 10mm socket screws', part_number: null, category: 'hardware', location: 'Drawer 4', notes: null, quantity: 60, consumable: true, unit: 'screws', low_stock_at: 100, created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp },
  ];

  const checkouts: PartCheckout[] = [
    { id: 'checkout-1', part_id: 'part-motor', user_id: DEMO_PIT_ID, quantity: 4, consumed: false, purpose: 'Competition robot drivetrain', checked_out_at: daysFromNow(-2), returned_at: null, returned_by: null },
    { id: 'checkout-2', part_id: 'part-servo', user_id: DEMO_ADMIN_ID, quantity: 2, consumed: false, purpose: 'Intake prototype', checked_out_at: daysFromNow(-1), returned_at: null, returned_by: null },
    { id: 'checkout-3', part_id: 'part-filament', user_id: DEMO_ADMIN_ID, quantity: 320, consumed: true, purpose: 'Intake side plates', checked_out_at: daysFromNow(-3), returned_at: null, returned_by: null },
  ];

  return {
    profiles: [
      makeProfile({ id: DEMO_ADMIN_ID, full_name: 'Alex Rivera', email: 'alex.rivera@gentoorobotics.org', role: 'admin', functional_roles: ['scouter', 'pit', 'strategist'] }),
      makeProfile({ id: DEMO_SCOUTER_ID, full_name: 'Maya Chen', email: 'maya@example.com', role: 'member', functional_roles: ['scouter'] }),
      makeProfile({ id: DEMO_PIT_ID, full_name: 'Radean Patel', email: 'radean@example.com', role: 'member', functional_roles: ['pit'] }),
      makeProfile({ id: DEMO_STRATEGIST_ID, full_name: 'Yan Xu', email: 'yan@example.com', role: 'member', functional_roles: ['strategist'] }),
    ],
    notifications: [
      { id: 'notif-1', user_id: DEMO_ADMIN_ID, type: 'assignment', title: 'New scouting assignment', body: 'Scout team 11248 in Qual 1', data: { matchId: 'match-1' }, read: false, created_at: timestamp },
      { id: 'notif-2', user_id: DEMO_ADMIN_ID, type: 'talkie_request', title: 'Talkie: team 7244', body: 'Ask whether they have spare string for their lift.', data: { teamNumber: 7244 }, read: true, created_at: daysFromNow(-1) },
    ],
    capabilityQuestions: questions,
    scoutedTeams: teams,
    pitEntries,
    pitAnswers,
    matches,
    assignments,
    matchReports,
    talkieRequests: [
      { id: 'talkie-1', requester_id: DEMO_STRATEGIST_ID, team_number: 7244, reason: 'Ask if their autonomous is alliance-position dependent.', status: 'open', claimed_by: null, claimed_at: null, response: null, resolved_at: null, created_at: timestamp },
      { id: 'talkie-2', requester_id: DEMO_ADMIN_ID, team_number: 3596, reason: 'Confirm drivetrain motor count.', status: 'claimed', claimed_by: DEMO_PIT_ID, claimed_at: timestamp, response: null, resolved_at: null, created_at: daysFromNow(-1) },
    ],
    projects,
    tasks,
    pitShifts: [
      { id: 'shift-1', start_time: hoursFromNow(-1), end_time: hoursFromNow(1), assignee_id: DEMO_PIT_ID, generated: true, created_at: timestamp },
      { id: 'shift-2', start_time: hoursFromNow(1), end_time: hoursFromNow(3), assignee_id: DEMO_ADMIN_ID, generated: true, created_at: timestamp },
    ],
    parts,
    checkouts,
    seededAt: timestamp,
  };
}

async function persist() {
  if (workspace) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

export async function initDemoAuth(): Promise<boolean> {
  active = (await AsyncStorage.getItem(AUTH_KEY)) === 'true';
  if (active) await getDemoWorkspace();
  return active;
}

export async function startDemoAuth() {
  active = true;
  await AsyncStorage.setItem(AUTH_KEY, 'true');
  workspace = seedWorkspace();
  await persist();
}

export async function stopDemoAuth() {
  active = false;
  workspace = null;
  await AsyncStorage.removeItem(AUTH_KEY);
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function isDemoMode() {
  return active;
}

export function demoSession() {
  return {
    user: {
      id: DEMO_USER_ID,
      email: 'alex.rivera@gentoorobotics.org',
      user_metadata: { full_name: 'Alex Rivera' },
    },
    access_token: 'demo',
    refresh_token: 'demo',
    expires_in: 31536000,
    token_type: 'bearer',
  } as any;
}

const MAX_SEED_AGE_MS = 12 * 3_600_000;

export async function getDemoWorkspace(): Promise<DemoWorkspace> {
  if (workspace) return workspace;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed = raw ? (JSON.parse(raw) as DemoWorkspace) : null;
  // Seed times are relative to the seed moment (match countdown, shifts, due
  // dates), so an old workspace reads as a dead event. Re-roll stale ones —
  // including pre-seededAt workspaces persisted by earlier app versions.
  const fresh =
    parsed?.seededAt != null &&
    Date.now() - new Date(parsed.seededAt).getTime() < MAX_SEED_AGE_MS;
  workspace = fresh ? parsed : seedWorkspace();
  await persist();
  return workspace;
}

export async function demoCurrentUserId() {
  return isDemoMode() ? DEMO_USER_ID : undefined;
}

export async function demoProfile() {
  const db = await getDemoWorkspace();
  return db.profiles.find((p) => p.id === DEMO_USER_ID) ?? null;
}

export async function demoProfiles() {
  return (await getDemoWorkspace()).profiles;
}

export async function demoSetProfile(idValue: string, patch: Partial<Pick<Profile, 'status' | 'role' | 'functional_roles'>>) {
  const db = await getDemoWorkspace();
  db.profiles = db.profiles.map((p) => (p.id === idValue ? { ...p, ...patch, updated_at: now() } : p));
  await persist();
}

function answerScore(answer: AnswerValue): number | null {
  if (answer === 'yes') return 1;
  if (answer === 'no') return 0;
  return null;
}

export async function demoCapabilityQuestions(activeOnly = true) {
  const db = await getDemoWorkspace();
  return db.capabilityQuestions
    .filter((q) => !activeOnly || q.active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function demoTeamScores(): Promise<TeamScore[]> {
  const db = await getDemoWorkspace();
  return db.scoutedTeams
    .map((team) => {
      const entries = db.pitEntries.filter((e) => e.scouted_team_id === team.id);
      const answers = entries.flatMap((entry) => db.pitAnswers.filter((a) => a.entry_id === entry.id));
      const weighted = db.capabilityQuestions.map((q) => {
        const values = answers
          .filter((a) => a.question_id === q.id)
          .map((a) => answerScore(a.answer))
          .filter((v): v is number => v !== null);
        if (values.length === 0) return null;
        return { score: values.reduce((sum, v) => sum + v, 0) / values.length, weight: q.weight };
      }).filter((v): v is { score: number; weight: number } => !!v);
      const totalWeight = weighted.reduce((sum, v) => sum + v.weight, 0) || 1;
      const score = Math.round((weighted.reduce((sum, v) => sum + v.score * v.weight, 0) / totalWeight) * 100);
      return {
        team_id: team.id,
        team_number: team.team_number,
        team_name: team.team_name,
        score,
        entry_count: entries.length,
        official_rank: team.official_rank,
        official_wins: team.official_wins,
        official_losses: team.official_losses,
        official_ties: team.official_ties,
        official_avg_points: team.official_avg_points,
      };
    })
    .sort((a, b) => b.score - a.score || a.team_number - b.team_number);
}

export async function demoTeamDetail(teamId: string) {
  const db = await getDemoWorkspace();
  const team = db.scoutedTeams.find((t) => t.id === teamId) ?? null;
  const entries = db.pitEntries
    .filter((e) => e.scouted_team_id === teamId)
    .map((entry) => {
      const scouter = db.profiles.find((p) => p.id === entry.scouter_id);
      return {
        id: entry.id,
        notes: entry.notes,
        created_at: entry.created_at,
        scouter: scouter ? { full_name: scouter.full_name, avatar_url: scouter.avatar_url } : null,
        answers: db.pitAnswers.filter((a) => a.entry_id === entry.id),
      };
    });
  return { team, entries };
}

export async function demoSubmitPitEntry(input: {
  teamNumber: number;
  teamName?: string;
  notes?: string;
  answers: { questionId: string; answer: AnswerValue }[];
}) {
  const db = await getDemoWorkspace();
  let team = db.scoutedTeams.find((t) => t.team_number === input.teamNumber);
  if (!team) {
    team = {
      id: id('team'),
      team_number: input.teamNumber,
      team_name: input.teamName ?? null,
      notes: null,
      created_by: DEMO_USER_ID,
      created_at: now(),
      updated_at: now(),
      picklist_tier: null,
      picklist_rank: null,
      picklist_notes: null,
      // Scouted by hand, so there's no official standing to show yet.
      ...EMPTY_STANDINGS,
      stats_synced_at: null,
    };
    db.scoutedTeams.push(team);
  } else if (input.teamName && !team.team_name) {
    team.team_name = input.teamName;
    team.updated_at = now();
  }
  const entry: PitEntry = {
    id: id('pit-entry'),
    scouted_team_id: team.id,
    scouter_id: DEMO_USER_ID,
    notes: input.notes ?? null,
    created_at: now(),
  };
  db.pitEntries.push(entry);
  db.pitAnswers.push(
    ...input.answers.map((a) => ({
      id: id('pit-answer'),
      entry_id: entry.id,
      question_id: a.questionId,
      answer: a.answer,
    }))
  );
  await persist();
  return { teamId: team.id };
}

export async function demoCreateQuestion(vars: { prompt: string; category: string; weight: number; sort_order: number }) {
  const db = await getDemoWorkspace();
  db.capabilityQuestions.push({ id: id('question'), active: true, created_at: now(), ...vars });
  await persist();
}

export async function demoUpdateQuestion(idValue: string, patch: Partial<CapabilityQuestion>) {
  const db = await getDemoWorkspace();
  db.capabilityQuestions = db.capabilityQuestions.map((q) => (q.id === idValue ? { ...q, ...patch } : q));
  await persist();
}

export async function demoDeleteQuestion(idValue: string) {
  const db = await getDemoWorkspace();
  db.capabilityQuestions = db.capabilityQuestions.filter((q) => q.id !== idValue);
  db.pitAnswers = db.pitAnswers.filter((a) => a.question_id !== idValue);
  await persist();
}

export async function demoPicklist() {
  const db = await getDemoWorkspace();
  const scores = await demoTeamScores();
  return scores.map((s) => {
    const team = db.scoutedTeams.find((t) => t.id === s.team_id);
    const capabilities: Record<string, number> = {};
    for (const q of db.capabilityQuestions) {
      const entries = db.pitEntries.filter((e) => e.scouted_team_id === s.team_id);
      const values = entries
        .flatMap((e) => db.pitAnswers.filter((a) => a.entry_id === e.id && a.question_id === q.id))
        .map((a) => answerScore(a.answer))
        .filter((v): v is number => v !== null);
      capabilities[q.id] = values.length ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) : 0;
    }
    return {
      id: s.team_id,
      team_number: s.team_number,
      team_name: s.team_name,
      score: s.score,
      entry_count: s.entry_count,
      tier: team?.picklist_tier ?? null,
      rank: team?.picklist_rank ?? null,
      notes: team?.picklist_notes ?? null,
      capabilities,
    };
  });
}

export async function demoSetPicklist(
  teamId: string,
  patch: { picklist_tier?: PicklistTier | null; picklist_rank?: number | null; picklist_notes?: string | null }
) {
  const db = await getDemoWorkspace();
  db.scoutedTeams = db.scoutedTeams.map((t) => (t.id === teamId ? { ...t, ...patch, updated_at: now() } : t));
  await persist();
}

export async function demoMatches() {
  const db = await getDemoWorkspace();
  return db.matches
    .map((m) => ({
      ...m,
      assignments: db.assignments
        .filter((a) => a.match_id === m.id)
        .map(({ id, scouter_id, team_number, status }) => ({ id, scouter_id, team_number, status })),
    }))
    .sort((a, b) => a.match_number - b.match_number);
}

export async function demoMyAssignments(uid = DEMO_USER_ID) {
  const db = await getDemoWorkspace();
  return db.assignments
    .filter((a) => a.scouter_id === uid)
    .map((a) => ({ ...a, match: db.matches.find((m) => m.id === a.match_id) ?? null }));
}

export async function demoMatchDetail(matchId: string) {
  const db = await getDemoWorkspace();
  return {
    match: db.matches.find((m) => m.id === matchId) ?? null,
    assignments: db.assignments
      .filter((a) => a.match_id === matchId)
      .map((a) => {
        const scouter = db.profiles.find((p) => p.id === a.scouter_id);
        return { ...a, scouter: scouter ? { full_name: scouter.full_name, avatar_url: scouter.avatar_url } : null };
      }),
    reports: db.matchReports.filter((r) => r.match_id === matchId),
  };
}

export async function demoUpsertMatches(rows: ParsedMatch[]) {
  const db = await getDemoWorkspace();
  for (const row of rows) {
    const existing = db.matches.find((m) => m.match_number === row.match_number);
    if (existing) Object.assign(existing, row);
      else {
        db.matches.push({
          id: id('match'),
          match_number: row.match_number,
          label: null,
          scheduled_time: null,
          red1: row.red1 ?? null,
          red2: row.red2 ?? null,
          blue1: row.blue1 ?? null,
          blue2: row.blue2 ?? null,
          created_at: now(),
        });
      }
  }
  await persist();
}

export async function demoDeleteMatch(idValue: string) {
  const db = await getDemoWorkspace();
  db.matches = db.matches.filter((m) => m.id !== idValue);
  db.assignments = db.assignments.filter((a) => a.match_id !== idValue);
  await persist();
}

export async function demoAssignScouter(vars: { matchId: string; scouterId: string; teamNumber?: number }) {
  const db = await getDemoWorkspace();
  db.assignments.push({ id: id('assignment'), match_id: vars.matchId, scouter_id: vars.scouterId, team_number: vars.teamNumber ?? null, status: 'assigned', assigned_by: DEMO_USER_ID, created_at: now() });
  await persist();
}

export async function demoRemoveAssignment(idValue: string) {
  const db = await getDemoWorkspace();
  db.assignments = db.assignments.filter((a) => a.id !== idValue);
  await persist();
}

export async function demoAutoAssign() {
  const db = await getDemoWorkspace();
  const candidates = db.profiles.filter((p) => p.status === 'approved' && p.functional_roles.includes('scouter'));
  const unassigned = db.matches.filter((m) => !db.assignments.some((a) => a.match_id === m.id));
  unassigned.forEach((m, index) => {
    const scouter = candidates[index % Math.max(candidates.length, 1)];
    if (scouter) db.assignments.push({ id: id('assignment'), match_id: m.id, scouter_id: scouter.id, team_number: null, status: 'assigned', assigned_by: DEMO_USER_ID, created_at: now() });
  });
  await persist();
  return { assigned: unassigned.length };
}

export async function demoSubmitMatchReport(vars: { assignmentId?: string; matchId: string; teamNumber: number; rating?: number; playedDefense: boolean; notes?: string }) {
  const db = await getDemoWorkspace();
  db.matchReports.push({ id: id('report'), assignment_id: vars.assignmentId ?? null, match_id: vars.matchId, scouter_id: DEMO_USER_ID, team_number: vars.teamNumber, rating: vars.rating ?? null, played_defense: vars.playedDefense, notes: vars.notes ?? null, created_at: now() });
  if (vars.assignmentId) db.assignments = db.assignments.map((a) => (a.id === vars.assignmentId ? { ...a, status: 'submitted' } : a));
  await persist();
}

export async function demoTalkieRequests() {
  const db = await getDemoWorkspace();
  return db.talkieRequests.map((r) => ({
    ...r,
    requester: db.profiles.find((p) => p.id === r.requester_id) ?? null,
    claimer: db.profiles.find((p) => p.id === r.claimed_by) ?? null,
  }));
}

export async function demoCreateTalkie(teamNumber: number, reason: string) {
  const db = await getDemoWorkspace();
  db.talkieRequests.unshift({ id: id('talkie'), requester_id: DEMO_USER_ID, team_number: teamNumber, reason, status: 'open', claimed_by: null, claimed_at: null, response: null, resolved_at: null, created_at: now() });
  await persist();
}

export async function demoPatchTalkie(idValue: string, patch: Partial<TalkieRequest>) {
  const db = await getDemoWorkspace();
  db.talkieRequests = db.talkieRequests.map((r) => (r.id === idValue ? { ...r, ...patch } : r));
  await persist();
}

export async function demoDeleteTalkie(idValue: string) {
  const db = await getDemoWorkspace();
  db.talkieRequests = db.talkieRequests.filter((r) => r.id !== idValue);
  await persist();
}

export async function demoProjects() {
  const db = await getDemoWorkspace();
  return db.projects
    .filter((p) => !p.deleted_at)
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at)
    )
    .map((p) => ({
      ...p,
      tasks: db.tasks
        .filter((t) => t.project_id === p.id && !t.deleted_at && t.status !== 'done')
        .map(({ id }) => ({ id })),
    }));
}

export async function demoTrashedProjects() {
  const db = await getDemoWorkspace();
  return db.projects
    .filter((p) => !!p.deleted_at)
    .map((p) => ({
      ...p,
      tasks: db.tasks.filter((t) => t.project_id === p.id).map(({ id }) => ({ id })),
    }));
}

export async function demoProject(projectId: string) {
  const db = await getDemoWorkspace();
  return {
    project: db.projects.find((p) => p.id === projectId) ?? null,
    tasks: db.tasks
      .filter((t) => t.project_id === projectId && !t.deleted_at)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at)),
  };
}

export async function demoTrashedTasks(projectId: string) {
  const db = await getDemoWorkspace();
  return db.tasks
    .filter((task) => task.project_id === projectId && !!task.deleted_at)
    .sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? ''));
}

export async function demoMyOpenTaskCount(uid = DEMO_USER_ID) {
  const db = await getDemoWorkspace();
  const activeProjects = new Set(db.projects.filter((p) => !p.deleted_at).map((p) => p.id));
  return db.tasks.filter(
    (t) =>
      !t.deleted_at &&
      (t.status === 'todo' || t.status === 'in_progress') &&
      t.assignee_ids.includes(uid) &&
      activeProjects.has(t.project_id)
  ).length;
}

export async function demoMyTasks(uid = DEMO_USER_ID, limit = 6) {
  const db = await getDemoWorkspace();
  const active = new Map(db.projects.filter((p) => !p.deleted_at).map((p) => [p.id, p]));
  return db.tasks
    .filter(
      (t) =>
        !t.deleted_at &&
        (t.status === 'todo' || t.status === 'in_progress') &&
        t.assignee_ids.includes(uid) &&
        active.has(t.project_id)
    )
    .sort((a, b) => (a.due_date ?? '￿').localeCompare(b.due_date ?? '￿'))
    .slice(0, limit)
    .map((t) => ({ ...t, project: { id: t.project_id, name: active.get(t.project_id)!.name } }));
}

function syncDemoProjectStatus(
  db: DemoWorkspace,
  projectId: string,
  forceInProgress = false
) {
  const project = db.projects.find((candidate) => candidate.id === projectId && !candidate.deleted_at);
  if (!project) return;

  const tasks = db.tasks.filter((task) => task.project_id === projectId && !task.deleted_at);
  if (tasks.length === 0) return;

  const unfinished = tasks.filter((task) => task.status !== 'done');
  const blockedCount = unfinished.filter((task) => task.status === 'blocked').length;
  const hasInProgressTask = unfinished.some((task) => task.status === 'in_progress');
  let nextStatus: ProjectStatus | null = null;

  if (unfinished.length === 0) {
    nextStatus = 'done';
  } else if (forceInProgress && (project.status === 'done' || project.status === 'on_hold')) {
    nextStatus = 'active';
  } else if (blockedCount === unfinished.length) {
    nextStatus = 'on_hold';
  } else if (project.status === 'done' || project.status === 'on_hold') {
    nextStatus = 'active';
  } else if (project.status === 'planning' && hasInProgressTask) {
    nextStatus = 'active';
  }

  if (nextStatus && nextStatus !== project.status) {
    project.status = nextStatus;
    project.updated_at = now();
  }
}

function unblockDemoTasks(
  db: DemoWorkspace,
  isBlockedBy: (task: Task) => boolean,
  blockerName: string
) {
  const timestamp = now();
  let unblockedCount = 0;
  const affectedProjectIds = new Set<string>();
  db.tasks = db.tasks.map((task) => {
    if (task.status !== 'blocked' || !isBlockedBy(task)) return task;
    unblockedCount += 1;
    affectedProjectIds.add(task.project_id);

    for (const userId of new Set(task.assignee_ids)) {
      db.notifications.push({
        id: id('notification'),
        user_id: userId,
        type: 'task',
        title: 'Task unblocked',
        body: `Your task "${task.title}" has been unblocked because "${blockerName}" is done.`,
        data: { projectId: task.project_id, taskId: task.id },
        read: false,
        created_at: timestamp,
      });
    }

    return {
      ...task,
      status: 'todo',
      blocked_by: null,
      blocked_by_project: null,
      updated_at: timestamp,
    };
  });
  for (const projectId of affectedProjectIds) {
    syncDemoProjectStatus(db, projectId, true);
  }
  return unblockedCount;
}

export async function demoCreateProject(vars: { name: string; description?: string; status: ProjectStatus; priority: Priority; sort_order?: number }) {
  const db = await getDemoWorkspace();
  const sortOrder =
    vars.sort_order ??
    Math.max(
      0,
      ...db.projects
        .filter((project) => !project.deleted_at)
        .map((project) => project.sort_order ?? 0)
    ) + 10;
  db.projects.push({ id: id('project'), name: vars.name, description: vars.description ?? null, status: vars.status, priority: vars.priority, sort_order: sortOrder, created_by: DEMO_USER_ID, created_at: now(), updated_at: now(), deleted_at: null });
  await persist();
}

export async function demoUpdateProject(idValue: string, patch: Partial<Pick<Project, 'name' | 'description' | 'status' | 'priority'>>) {
  const db = await getDemoWorkspace();
  const previous = db.projects.find((project) => project.id === idValue);
  db.projects = db.projects.map((p) => (p.id === idValue ? { ...p, ...patch, updated_at: now() } : p));
  let unblockedCount = 0;
  if (previous && previous.status !== 'done' && patch.status === 'done') {
    unblockedCount = unblockDemoTasks(
      db,
      (task) => task.blocked_by_project === idValue,
      patch.name ?? previous.name
    );
  }
  if (patch.status === 'planning') {
    syncDemoProjectStatus(db, idValue);
  }
  await persist();
  return unblockedCount;
}

export async function demoTrashProject(idValue: string) {
  const db = await getDemoWorkspace();
  db.projects = db.projects.map((p) => (p.id === idValue ? { ...p, deleted_at: now(), updated_at: now() } : p));
  await persist();
}

export async function demoRestoreProject(idValue: string) {
  const db = await getDemoWorkspace();
  db.projects = db.projects.map((p) => (p.id === idValue ? { ...p, deleted_at: null, updated_at: now() } : p));
  await persist();
}

export async function demoDeleteProject(idValue: string) {
  const db = await getDemoWorkspace();
  db.projects = db.projects.filter((p) => p.id !== idValue);
  db.tasks = db.tasks
    .filter((t) => t.project_id !== idValue)
    .map((t) => (t.blocked_by_project === idValue ? { ...t, blocked_by_project: null } : t));
  await persist();
}

export async function demoReorderProjects(projectIds: string[]) {
  const db = await getDemoWorkspace();
  const positions = new Map(projectIds.map((idValue, index) => [idValue, (index + 1) * 10]));
  db.projects = db.projects.map((project) => {
    const sortOrder = positions.get(project.id);
    return sortOrder === undefined ? project : { ...project, sort_order: sortOrder };
  });
  await persist();
}

export async function demoCreateTask(vars: { project_id: string; title: string; notes: string | null; status: TaskStatus; assignee_ids: string[]; blocked_by: string | null; blocked_by_project: string | null; due_date: string | null; priority: Priority; tags: string[]; sort_order?: number }) {
  const db = await getDemoWorkspace();
  const taskId = id('task');
  const sortOrder =
    vars.sort_order ??
    nextTaskSortOrder(
      db.tasks.filter((task) => task.project_id === vars.project_id && !task.deleted_at)
    );
  db.tasks.push({ id: taskId, created_by: DEMO_USER_ID, created_at: now(), updated_at: now(), deleted_at: null, ...vars, sort_order: sortOrder });
  syncDemoProjectStatus(db, vars.project_id, true);
  await persist();
  return taskId;
}

export async function demoUpdateTask(idValue: string, patch: Partial<Omit<Task, 'id' | 'project_id' | 'created_at' | 'updated_at'>>) {
  const db = await getDemoWorkspace();
  const previous = db.tasks.find((task) => task.id === idValue);
  db.tasks = db.tasks.map((t) => (t.id === idValue ? { ...t, ...patch, updated_at: now() } : t));
  let unblockedCount = 0;
  if (previous && previous.status !== 'done' && patch.status === 'done') {
    unblockedCount = unblockDemoTasks(
      db,
      (task) => task.blocked_by === idValue,
      patch.title ?? previous.title
    );
  }
  if (previous && (patch.status !== undefined || patch.deleted_at !== undefined)) {
    const wasUnblocked =
      previous.status === 'blocked' &&
      (patch.status === 'todo' || patch.status === 'in_progress');
    syncDemoProjectStatus(db, previous.project_id, wasUnblocked);
  }
  await persist();
  return unblockedCount;
}

export async function demoReorderTasks(taskIds: string[]) {
  const db = await getDemoWorkspace();
  const positions = new Map(taskIds.map((idValue, index) => [idValue, (index + 1) * 10]));
  db.tasks = db.tasks.map((task) => {
    const sortOrder = positions.get(task.id);
    return sortOrder === undefined ? task : { ...task, sort_order: sortOrder };
  });
  await persist();
}

export async function demoDeleteTask(idValue: string) {
  const db = await getDemoWorkspace();
  const task = db.tasks.find((candidate) => candidate.id === idValue);
  db.tasks = db.tasks.map((task) =>
    task.id === idValue ? { ...task, deleted_at: now(), updated_at: now() } : task
  );
  if (task) syncDemoProjectStatus(db, task.project_id);
  await persist();
}

export async function demoRestoreTask(idValue: string) {
  const db = await getDemoWorkspace();
  const task = db.tasks.find((candidate) => candidate.id === idValue);
  db.tasks = db.tasks.map((task) =>
    task.id === idValue ? { ...task, deleted_at: null, updated_at: now() } : task
  );
  if (task) syncDemoProjectStatus(db, task.project_id);
  await persist();
}

export async function demoDeleteTaskForever(idValue: string) {
  const db = await getDemoWorkspace();
  const task = db.tasks.find((candidate) => candidate.id === idValue);
  db.tasks = db.tasks
    .filter((t) => t.id !== idValue)
    .map((t) => (t.blocked_by === idValue ? { ...t, blocked_by: null } : t));
  if (task) syncDemoProjectStatus(db, task.project_id);
  await persist();
}

export async function demoPitShifts() {
  const db = await getDemoWorkspace();
  return db.pitShifts.map((s) => {
    const assignee = db.profiles.find((p) => p.id === s.assignee_id);
    return { ...s, assignee: assignee ? { full_name: assignee.full_name, avatar_url: assignee.avatar_url } : null };
  });
}

export async function demoReplaceSchedule(shifts: GeneratedShift[]) {
  const db = await getDemoWorkspace();
  db.pitShifts = shifts.map((s) => ({ id: id('shift'), start_time: s.start.toISOString(), end_time: s.end.toISOString(), assignee_id: s.assigneeId, generated: true, created_at: now() }));
  await persist();
}

export async function demoPatchShift(idValue: string, assigneeId: string | null) {
  const db = await getDemoWorkspace();
  db.pitShifts = db.pitShifts.map((s) => (s.id === idValue ? { ...s, assignee_id: assigneeId } : s));
  await persist();
}

export async function demoDeleteShift(idValue: string) {
  const db = await getDemoWorkspace();
  db.pitShifts = db.pitShifts.filter((s) => s.id !== idValue);
  await persist();
}

export async function demoNotifications(uid = DEMO_USER_ID) {
  const db = await getDemoWorkspace();
  return db.notifications.filter((n) => n.user_id === uid).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function demoMarkNotificationRead(idValue: string) {
  const db = await getDemoWorkspace();
  db.notifications = db.notifications.map((n) => (n.id === idValue ? { ...n, read: true } : n));
  await persist();
}

export async function demoMarkAllNotificationsRead(uid = DEMO_USER_ID) {
  const db = await getDemoWorkspace();
  db.notifications = db.notifications.map((n) => (n.user_id === uid ? { ...n, read: true } : n));
  await persist();
}

export async function demoClearNotification(idValue: string) {
  const db = await getDemoWorkspace();
  db.notifications = db.notifications.filter((n) => n.id !== idValue);
  await persist();
}

export async function demoClearAllNotifications(uid = DEMO_USER_ID) {
  const db = await getDemoWorkspace();
  db.notifications = db.notifications.filter((n) => n.user_id !== uid);
  await persist();
}

const isOpenCheckout = (c: PartCheckout) => !c.consumed && !c.returned_at;

export async function demoParts() {
  const db = await getDemoWorkspace();
  return db.parts
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((part) => ({
      ...part,
      open: db.checkouts
        .filter((c) => c.part_id === part.id && isOpenCheckout(c))
        .map(({ id: checkoutId, quantity, user_id }) => ({ id: checkoutId, quantity, user_id })),
    }));
}

export async function demoPart(partId: string) {
  const db = await getDemoWorkspace();
  const profileOf = (uid: string | null) => {
    const profile = uid ? db.profiles.find((p) => p.id === uid) : null;
    return profile
      ? { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url }
      : null;
  };
  return {
    part: db.parts.find((p) => p.id === partId) ?? null,
    checkouts: db.checkouts
      .filter((c) => c.part_id === partId)
      .sort((a, b) => b.checked_out_at.localeCompare(a.checked_out_at))
      .map((c) => ({ ...c, user: profileOf(c.user_id) })),
  };
}

export async function demoMyOpenCheckoutCount(uid = DEMO_USER_ID) {
  const db = await getDemoWorkspace();
  return db.checkouts.filter((c) => c.user_id === uid && isOpenCheckout(c)).length;
}

export async function demoCreatePart(
  vars: Omit<Part, 'id' | 'created_by' | 'created_at' | 'updated_at'>
) {
  const db = await getDemoWorkspace();
  const partId = id('part');
  db.parts.push({
    ...vars,
    id: partId,
    created_by: DEMO_USER_ID,
    created_at: now(),
    updated_at: now(),
  });
  await persist();
  return partId;
}


export async function demoUpdatePart(idValue: string, patch: Partial<Part>) {
  const db = await getDemoWorkspace();
  db.parts = db.parts.map((p) => (p.id === idValue ? { ...p, ...patch, updated_at: now() } : p));
  await persist();
}

export async function demoDeletePart(idValue: string) {
  const db = await getDemoWorkspace();
  db.parts = db.parts.filter((p) => p.id !== idValue);
  db.checkouts = db.checkouts.filter((c) => c.part_id !== idValue);
  await persist();
}

/** Mirrors the inventory_checkouts stock trigger: consuming deducts stock. */
export async function demoCheckoutPart(vars: {
  part_id: string;
  quantity: number;
  consumed: boolean;
  purpose: string | null;
}) {
  const db = await getDemoWorkspace();
  db.checkouts.push({
    ...vars,
    id: id('checkout'),
    user_id: DEMO_USER_ID,
    checked_out_at: now(),
    returned_at: null,
    returned_by: null,
  });
  if (vars.consumed) {
    db.parts = db.parts.map((p) =>
      p.id === vars.part_id
        ? { ...p, quantity: Math.max(0, p.quantity - vars.quantity), updated_at: now() }
        : p
    );
  }
  await persist();
}

export async function demoReturnCheckout(idValue: string) {
  const db = await getDemoWorkspace();
  db.checkouts = db.checkouts.map((c) =>
    c.id === idValue ? { ...c, returned_at: now(), returned_by: DEMO_USER_ID } : c
  );
  await persist();
}
