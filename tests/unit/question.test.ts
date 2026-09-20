import { describe, expect, it } from 'vitest';
import { toPublicQuestion, validateQuestion, type Question } from '@hootka/core';

const question: Question = {
  id: 'q1',
  order: 0,
  text: 'Which animal says hoot?',
  imageUrl: 'https://example.test/owl.png',
  timeLimit: 10,
  options: [{ text: 'Owl' }, { text: 'Cow' }, { text: 'Frog' }],
  correctIndex: 0,
};

describe('toPublicQuestion', () => {
  // Checklist: players must not be able to see correctIndex before the reveal.
  it('strips the correct answer', () => {
    const published = toPublicQuestion(question);
    expect(published).not.toHaveProperty('correctIndex');
    expect(JSON.stringify(published)).not.toContain('correctIndex');
  });

  it('publishes only text, image and option labels', () => {
    expect(Object.keys(toPublicQuestion(question)).sort()).toEqual(['imageUrl', 'options', 'text']);
  });

  it('strips unknown fields that an editor might have added', () => {
    const withExtra = { ...question, answerKey: 0, teacherNotes: 'it is the owl' } as Question;
    const published = JSON.stringify(toPublicQuestion(withExtra));
    expect(published).not.toContain('answerKey');
    expect(published).not.toContain('teacherNotes');
  });

  it('copies option objects rather than sharing them', () => {
    const published = toPublicQuestion(question);
    expect(published.options[0]).not.toBe(question.options[0]);
    expect(published.options[0]?.text).toBe('Owl');
  });

  it('normalises a missing image to null', () => {
    const { imageUrl, ...withoutImage } = question;
    expect(toPublicQuestion(withoutImage as Question).imageUrl).toBeNull();
  });
});

describe('validateQuestion', () => {
  it('accepts a well-formed question', () => {
    expect(validateQuestion(question)).toEqual([]);
  });

  it('accepts a two-option true/false question', () => {
    expect(
      validateQuestion({ ...question, options: [{ text: 'True' }, { text: 'False' }], correctIndex: 1 }),
    ).toEqual([]);
  });

  it('requires question text', () => {
    expect(validateQuestion({ ...question, text: '   ' })).toContain('missing_text');
  });

  it('requires between 2 and 4 options', () => {
    expect(validateQuestion({ ...question, options: [{ text: 'Only' }], correctIndex: 0 })).toContain(
      'too_few_options',
    );
    expect(
      validateQuestion({
        ...question,
        options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }, { text: 'e' }],
      }),
    ).toContain('too_many_options');
  });

  it('rejects a blank option', () => {
    expect(validateQuestion({ ...question, options: [{ text: 'Owl' }, { text: ' ' }] })).toContain(
      'empty_option',
    );
  });

  it('rejects a correct index that points outside the options', () => {
    expect(validateQuestion({ ...question, correctIndex: 9 })).toContain('bad_correct_index');
    expect(validateQuestion({ ...question, correctIndex: -1 })).toContain('bad_correct_index');
    expect(validateQuestion({ ...question, correctIndex: undefined })).toContain('bad_correct_index');
  });
});
