import { describe, expect, it } from 'vitest';
import { officialSummary, summarizeAnswers, summarizeEntry } from '@/lib/scoring';
import type { AnswerValue, CapabilityQuestion } from '@/lib/types';

const question = (id: string, category = 'auto'): CapabilityQuestion => ({
  id,
  prompt: `Question ${id}`,
  category,
  weight: 1,
  sort_order: 0,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
});

const answer = (question_id: string, value: AnswerValue) => ({
  question_id,
  answer: value,
});

describe('summarizeAnswers', () => {
  it('counts yes / no / did-not-see per question', () => {
    const [q1] = summarizeAnswers(
      [question('q1')],
      [
        answer('q1', 'yes'),
        answer('q1', 'yes'),
        answer('q1', 'no'),
        answer('q1', 'did_not_see'),
      ]
    );
    expect(q1.yes).toBe(2);
    expect(q1.no).toBe(1);
    expect(q1.didNotSee).toBe(1);
    expect(q1.answered).toBe(3);
    expect(q1.yesFraction).toBeCloseTo(2 / 3);
    expect(q1.percent).toBe(67);
  });

  it('ignores did-not-see in the fraction denominator', () => {
    const [q1] = summarizeAnswers(
      [question('q1')],
      [answer('q1', 'yes'), answer('q1', 'did_not_see'), answer('q1', 'did_not_see')]
    );
    expect(q1.yesFraction).toBe(1);
    expect(q1.percent).toBe(100);
  });

  it('returns null fraction when only did-not-see answers exist', () => {
    const [q1] = summarizeAnswers([question('q1')], [answer('q1', 'did_not_see')]);
    expect(q1.answered).toBe(0);
    expect(q1.yesFraction).toBeNull();
    expect(q1.percent).toBeNull();
  });

  it('includes unanswered questions with zeroed counts', () => {
    const [q1, q2] = summarizeAnswers(
      [question('q1'), question('q2')],
      [answer('q1', 'no')]
    );
    expect(q1.percent).toBe(0);
    expect(q2).toMatchObject({ yes: 0, no: 0, didNotSee: 0, answered: 0, percent: null });
  });

  it('keeps answers scoped to their own question', () => {
    const [q1, q2] = summarizeAnswers(
      [question('q1'), question('q2')],
      [answer('q1', 'yes'), answer('q2', 'no')]
    );
    expect(q1.percent).toBe(100);
    expect(q2.percent).toBe(0);
  });
});

describe('summarizeEntry', () => {
  it('returns one row per answered question, in question order', () => {
    const summary = summarizeEntry(
      [question('q1'), question('q2'), question('q3')],
      [answer('q3', 'no'), answer('q1', 'yes')]
    );
    expect(summary.rows.map((r) => r.question.id)).toEqual(['q1', 'q3']);
    expect(summary.rows.map((r) => r.answer)).toEqual(['yes', 'no']);
  });

  it('counts each answer kind', () => {
    const summary = summarizeEntry(
      [question('q1'), question('q2'), question('q3'), question('q4')],
      [
        answer('q1', 'yes'),
        answer('q2', 'no'),
        answer('q3', 'did_not_see'),
        answer('q4', 'yes'),
      ]
    );
    expect(summary).toMatchObject({ yes: 2, no: 1, didNotSee: 1 });
    expect(summary.rows).toHaveLength(4);
  });

  it('leaves out questions this report did not answer', () => {
    const summary = summarizeEntry([question('q1'), question('q2')], [answer('q1', 'yes')]);
    expect(summary.rows).toHaveLength(1);
    expect(summary).toMatchObject({ yes: 1, no: 0, didNotSee: 0 });
  });

  it('skips answers whose question no longer exists, keeping counts in sync', () => {
    const summary = summarizeEntry([question('q1')], [answer('q1', 'yes'), answer('deleted', 'no')]);
    expect(summary.rows).toHaveLength(1);
    expect(summary.no).toBe(0);
  });

  it('takes the first answer when a question is answered twice', () => {
    const summary = summarizeEntry([question('q1')], [answer('q1', 'yes'), answer('q1', 'no')]);
    expect(summary.rows).toEqual([{ question: question('q1'), answer: 'yes' }]);
    expect(summary).toMatchObject({ yes: 1, no: 0 });
  });

  it('preserves the category so the UI can group rows', () => {
    const summary = summarizeEntry(
      [question('q1', 'Autonomous'), question('q2', 'Endgame')],
      [answer('q1', 'yes'), answer('q2', 'no')]
    );
    expect(summary.rows.map((r) => r.question.category)).toEqual(['Autonomous', 'Endgame']);
  });

  it('handles a report with no answers', () => {
    expect(summarizeEntry([question('q1')], [])).toEqual({
      rows: [],
      yes: 0,
      no: 0,
      didNotSee: 0,
    });
  });
});

describe('officialSummary', () => {
  const stats = (over: Partial<Parameters<typeof officialSummary>[0]> = {}) => ({
    official_rank: null,
    official_wins: null,
    official_losses: null,
    official_ties: null,
    official_avg_points: null,
    ...over,
  });

  it('joins rank, record, and average score', () => {
    expect(
      officialSummary(
        stats({
          official_rank: 3,
          official_wins: 8,
          official_losses: 2,
          official_ties: 0,
          official_avg_points: 142.5,
        })
      )
    ).toBe('Rank 3 · 8-2-0 · 142.5 avg');
  });

  it('leaves out the parts that are missing', () => {
    expect(officialSummary(stats({ official_rank: 4 }))).toBe('Rank 4');
    expect(officialSummary(stats({ official_avg_points: 90 }))).toBe('90.0 avg');
  });

  it('is empty when nothing has been synced, so callers can hide the line', () => {
    expect(officialSummary(stats())).toBe('');
  });

  it('handles a numeric column arriving as a string', () => {
    // PostgREST can serialize `numeric` as a string depending on the driver.
    expect(officialSummary(stats({ official_avg_points: '128.25' as unknown as number }))).toBe(
      '128.3 avg'
    );
  });
});
