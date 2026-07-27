import { teamRecord } from '@/lib/format';
import type { AnswerValue, CapabilityQuestion, OfficialStats } from '@/lib/types';

/**
 * One-line official standing for a team, e.g. "Rank 3 · 8-2-0 · 142.5 avg".
 * Empty string when this team has no synced standings, so callers can hide the
 * line entirely rather than print a row of blanks.
 */
export function officialSummary(stats: OfficialStats): string {
  const avg = stats.official_avg_points;
  return [
    stats.official_rank != null ? `Rank ${stats.official_rank}` : null,
    teamRecord(stats.official_wins, stats.official_losses, stats.official_ties),
    avg != null ? `${Number(avg).toFixed(1)} avg` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export type EntryAnswerRow = {
  question: CapabilityQuestion;
  answer: AnswerValue;
};

export type EntrySummary = {
  /** Answered questions in question order (unanswered ones are left out). */
  rows: EntryAnswerRow[];
  yes: number;
  no: number;
  didNotSee: number;
};

/**
 * One scouter's report: what they answered, question by question. Answers whose
 * question no longer exists are skipped — there's no prompt to show — so the
 * counts always match the rows.
 */
export function summarizeEntry(
  questions: CapabilityQuestion[],
  answers: { question_id: string; answer: AnswerValue }[]
): EntrySummary {
  const byQuestion = new Map<string, AnswerValue>();
  // First answer wins: nothing stops a duplicate row per question in the DB.
  for (const a of answers) {
    if (!byQuestion.has(a.question_id)) byQuestion.set(a.question_id, a.answer);
  }

  const rows: EntryAnswerRow[] = [];
  let yes = 0;
  let no = 0;
  let didNotSee = 0;
  for (const question of questions) {
    const answer = byQuestion.get(question.id);
    if (!answer) continue;
    if (answer === 'yes') yes += 1;
    else if (answer === 'no') no += 1;
    else didNotSee += 1;
    rows.push({ question, answer });
  }

  return { rows, yes, no, didNotSee };
}

export type QuestionBreakdown = {
  question: CapabilityQuestion;
  yes: number;
  no: number;
  didNotSee: number;
  answered: number;
  /** yes / (yes + no), or null when only "did not see" answers exist. */
  yesFraction: number | null;
  /** yesFraction as a 0..100 integer, or null. */
  percent: number | null;
};

/** Aggregate raw answers into a per-question breakdown for a team. */
export function summarizeAnswers(
  questions: CapabilityQuestion[],
  answers: { question_id: string; answer: AnswerValue }[]
): QuestionBreakdown[] {
  const counts = new Map<string, { yes: number; no: number; dns: number }>();
  for (const a of answers) {
    const c = counts.get(a.question_id) ?? { yes: 0, no: 0, dns: 0 };
    if (a.answer === 'yes') c.yes += 1;
    else if (a.answer === 'no') c.no += 1;
    else c.dns += 1;
    counts.set(a.question_id, c);
  }

  return questions.map((question) => {
    const c = counts.get(question.id) ?? { yes: 0, no: 0, dns: 0 };
    const answered = c.yes + c.no;
    const yesFraction = answered > 0 ? c.yes / answered : null;
    return {
      question,
      yes: c.yes,
      no: c.no,
      didNotSee: c.dns,
      answered,
      yesFraction,
      percent: yesFraction === null ? null : Math.round(yesFraction * 100),
    };
  });
}
