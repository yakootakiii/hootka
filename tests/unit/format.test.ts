import { describe, expect, it } from 'vitest';
import { feedbackHeadline, feedbackSubline, formatGameCode, formatPoints, ordinal } from '@/lib/format';

describe('ordinal', () => {
  it('uses the right suffix', () => {
    expect([1, 2, 3, 4, 10].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '10th']);
  });

  it('handles the teens, which are all "th"', () => {
    expect([11, 12, 13].map(ordinal)).toEqual(['11th', '12th', '13th']);
  });

  it('handles larger numbers a full class can reach', () => {
    expect([21, 22, 23, 42, 53].map(ordinal)).toEqual(['21st', '22nd', '23rd', '42nd', '53rd']);
  });
});

describe('formatGameCode', () => {
  it('splits the code into two groups for the projector', () => {
    expect(formatGameCode('123456')).toBe('123 456');
  });

  it('leaves a placeholder alone', () => {
    expect(formatGameCode('······')).toBe('······');
  });
});

describe('formatPoints', () => {
  it('groups thousands', () => {
    expect(formatPoints(12500)).toBe('12,500');
    expect(formatPoints(0)).toBe('0');
  });
});

describe('feedback copy', () => {
  it('celebrates speed without shaming a slower answer', () => {
    expect(feedbackHeadline(true, 980)).toBe('Lightning fast!');
    expect(feedbackHeadline(true, 750)).toBe('Nice one!');
    expect(feedbackHeadline(true, 520)).toBe('Correct!');
  });

  // Section 6: never shame a wrong answer or a low rank.
  it('stays encouraging when the answer was wrong', () => {
    const headline = feedbackHeadline(false, 0);
    const subline = feedbackSubline(false, 0);
    expect(headline).toBe('Not this time!');
    expect(subline).toContain('Good try');
    for (const word of ['wrong', 'fail', 'bad', 'loser']) {
      expect(`${headline} ${subline}`.toLowerCase()).not.toContain(word);
    }
  });

  it('calls out a streak', () => {
    expect(feedbackSubline(true, 4)).toBe('4 in a row!');
  });
});
