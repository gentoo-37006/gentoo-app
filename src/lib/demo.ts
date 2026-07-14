import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AnswerValue,
  AppNotification,
  CapabilityQuestion,
  FunctionalRole,
  Match,
  MatchReport,
  PicklistTier,
  PitAnswer,
  PitEntry,
  PitShift,
  Priority,
  Profile,
  Project,
  ProjectStatus,
  ScoutedTeam,
  ScoutingAssignment,
  TalkieRequest,
  Task,
  TaskStatus,
  TeamScore,
} from '@/lib/types';
import type { ParsedMatch } from '@/lib/csv';
import type { GeneratedShift } from '@/lib/scheduler';

const STORAGE_KEY = 'gentoo.demo.workspace.v1';
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
};

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

  const matches: Match[] = [
    { id: 'match-1', match_number: 1, label: 'Qual 1', scheduled_time: daysFromNow(0, 9), red1: 11248, red2: 7244, blue1: 3596, blue2: 9915, created_at: timestamp },
    { id: 'match-2', match_number: 2, label: 'Qual 2', scheduled_time: daysFromNow(0, 10), red1: 7244, red2: 3596, blue1: 11248, blue2: 14133, created_at: timestamp },
    { id: 'match-3', match_number: 3, label: 'Qual 3', scheduled_time: daysFromNow(0, 11), red1: 9915, red2: 11248, blue1: 7244, blue2: 3596, created_at: timestamp },
  ];

  const assignments: ScoutingAssignment[] = [
    { id: 'assignment-1', match_id: 'match-1', scouter_id: DEMO_ADMIN_ID, team_number: 11248, status: 'assigned', assigned_by: DEMO_STRATEGIST_ID, created_at: timestamp },
    { id: 'assignment-2', match_id: 'match-2', scouter_id: DEMO_SCOUTER_ID, team_number: 7244, status: 'submitted', assigned_by: DEMO_STRATEGIST_ID, created_at: timestamp },
  ];

  const matchReports: MatchReport[] = [
    { id: 'report-1', assignment_id: 'assignment-2', match_id: 'match-2', scouter_id: DEMO_SCOUTER_ID, team_number: 7244, rating: 4, played_defense: false, notes: 'Clean autonomous and one missed cycle.', created_at: timestamp },
  ];

  const projects: Project[] = [
    { id: 'project-pit', name: 'Pit readiness', description: 'Prep the pit before inspection.', status: 'active', priority: 'high', created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp, deleted_at: null },
    { id: 'project-scouting', name: 'Scouting setup', description: 'Validate match schedule and roles.', status: 'planning', priority: 'medium', created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp, deleted_at: null },
  ];

  const tasks: Task[] = [
    { id: 'task-1', project_id: 'project-pit', title: 'Label battery cables', status: 'in_progress', assignee_id: DEMO_PIT_ID, due_date: daysFromNow(1), priority: 'high', tags: ['pit', 'electrical'], created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp },
    { id: 'task-2', project_id: 'project-pit', title: 'Charge driver station laptop', status: 'todo', assignee_id: DEMO_ADMIN_ID, due_date: daysFromNow(0, 18), priority: 'urgent', tags: ['drive'], created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp },
    { id: 'task-3', project_id: 'project-scouting', title: 'Import qualification schedule', status: 'done', assignee_id: DEMO_STRATEGIST_ID, due_date: null, priority: 'medium', tags: ['scouting'], created_by: DEMO_ADMIN_ID, created_at: timestamp, updated_at: timestamp },
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
      { id: 'shift-1', start_time: daysFromNow(0, 8), end_time: daysFromNow(0, 10), assignee_id: DEMO_PIT_ID, generated: true, created_at: timestamp },
      { id: 'shift-2', start_time: daysFromNow(0, 10), end_time: daysFromNow(0, 12), assignee_id: DEMO_ADMIN_ID, generated: true, created_at: timestamp },
    ],
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

export async function getDemoWorkspace(): Promise<DemoWorkspace> {
  if (workspace) return workspace;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  workspace = raw ? (JSON.parse(raw) as DemoWorkspace) : seedWorkspace();
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
      return { team_id: team.id, team_number: team.team_number, team_name: team.team_name, score, entry_count: entries.length };
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
    .map((p) => ({
      ...p,
      tasks: db.tasks.filter((t) => t.project_id === p.id).map(({ id, status }) => ({ id, status })),
    }));
}

export async function demoTrashedProjects() {
  const db = await getDemoWorkspace();
  return db.projects
    .filter((p) => !!p.deleted_at)
    .map((p) => ({
      ...p,
      tasks: db.tasks.filter((t) => t.project_id === p.id).map(({ id, status }) => ({ id, status })),
    }));
}

export async function demoProject(projectId: string) {
  const db = await getDemoWorkspace();
  return {
    project: db.projects.find((p) => p.id === projectId) ?? null,
    tasks: db.tasks
      .filter((t) => t.project_id === projectId)
      .map((t) => {
        const assignee = db.profiles.find((p) => p.id === t.assignee_id);
        return { ...t, assignee: assignee ? { full_name: assignee.full_name, avatar_url: assignee.avatar_url } : null };
      }),
  };
}

export async function demoMyOpenTaskCount(uid = DEMO_USER_ID) {
  const db = await getDemoWorkspace();
  const activeProjects = new Set(db.projects.filter((p) => !p.deleted_at).map((p) => p.id));
  return db.tasks.filter(
    (t) => t.assignee_id === uid && t.status !== 'done' && activeProjects.has(t.project_id)
  ).length;
}

export async function demoMyTasks(uid = DEMO_USER_ID, limit = 6) {
  const db = await getDemoWorkspace();
  const active = new Map(db.projects.filter((p) => !p.deleted_at).map((p) => [p.id, p]));
  return db.tasks
    .filter((t) => t.assignee_id === uid && t.status !== 'done' && active.has(t.project_id))
    .sort((a, b) => (a.due_date ?? '￿').localeCompare(b.due_date ?? '￿'))
    .slice(0, limit)
    .map((t) => ({ ...t, project: { id: t.project_id, name: active.get(t.project_id)!.name } }));
}

export async function demoCreateProject(vars: { name: string; description?: string; status: ProjectStatus; priority: Priority }) {
  const db = await getDemoWorkspace();
  db.projects.unshift({ id: id('project'), name: vars.name, description: vars.description ?? null, status: vars.status, priority: vars.priority, created_by: DEMO_USER_ID, created_at: now(), updated_at: now(), deleted_at: null });
  await persist();
}

export async function demoUpdateProject(idValue: string, patch: Partial<Pick<Project, 'name' | 'description' | 'status' | 'priority'>>) {
  const db = await getDemoWorkspace();
  db.projects = db.projects.map((p) => (p.id === idValue ? { ...p, ...patch, updated_at: now() } : p));
  await persist();
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
  db.tasks = db.tasks.filter((t) => t.project_id !== idValue);
  await persist();
}

export async function demoCreateTask(vars: { project_id: string; title: string; status: TaskStatus; assignee_id: string | null; due_date: string | null; priority: Priority; tags: string[] }) {
  const db = await getDemoWorkspace();
  db.tasks.push({ id: id('task'), created_by: DEMO_USER_ID, created_at: now(), updated_at: now(), ...vars });
  await persist();
}

export async function demoUpdateTask(idValue: string, patch: Partial<Omit<Task, 'id' | 'project_id' | 'created_at' | 'updated_at'>>) {
  const db = await getDemoWorkspace();
  db.tasks = db.tasks.map((t) => (t.id === idValue ? { ...t, ...patch, updated_at: now() } : t));
  await persist();
}

export async function demoDeleteTask(idValue: string) {
  const db = await getDemoWorkspace();
  db.tasks = db.tasks.filter((t) => t.id !== idValue);
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
