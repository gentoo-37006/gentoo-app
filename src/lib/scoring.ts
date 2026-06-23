import type { AnswerValue, CapabilityQuestion } from '@/lib/types';

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

/** Weight-weighted average of yes-fractions → 0..100, matching team_scores. */
export function weightedScore(breakdowns: QuestionBreakdown[]): number {
  let numerator = 0;
  let denominator = 0;
  for (const b of breakdowns) {
    if (b.yesFraction === null) continue;
    numerator += b.question.weight * b.yesFraction;
    denominator += b.question.weight;
  }
  return denominator > 0 ? Math.round((100 * numerator) / denominator) : 0;
}

/** Tailwind text color class for a 0..100 score. */
export function scoreTint(score: number): string {
  if (score >= 70) return 'text-success';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}
