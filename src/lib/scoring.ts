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
