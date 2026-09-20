import { describe, expect, it } from 'vitest';
import { containsProfanity, normalizeForFilter, validateNickname } from '@hootka/core';

describe('validateNickname', () => {
  it('accepts an ordinary nickname and trims it', () => {
    const result = validateNickname('  Sunny Owl  ');
    expect(result).toEqual({ ok: true, name: 'Sunny Owl' });
  });

  it('collapses runs of whitespace', () => {
    expect(validateNickname('Sky    Bird')).toEqual({ ok: true, name: 'Sky Bird' });
  });

  it('rejects an empty or whitespace-only nickname', () => {
    expect(validateNickname('')).toMatchObject({ ok: false, reason: 'empty' });
    expect(validateNickname('   ')).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('rejects nicknames longer than 15 characters', () => {
    expect(validateNickname('a'.repeat(15))).toMatchObject({ ok: true });
    expect(validateNickname('a'.repeat(16))).toMatchObject({ ok: false, reason: 'too_long' });
  });

  it('rejects markup and other unsafe characters', () => {
    expect(validateNickname('<script>')).toMatchObject({ ok: false, reason: 'invalid_characters' });
    expect(validateNickname('bad/name')).toMatchObject({ ok: false, reason: 'invalid_characters' });
    expect(validateNickname('...')).toMatchObject({ ok: false, reason: 'invalid_characters' });
  });

  it('allows friendly punctuation and non-Latin letters', () => {
    expect(validateNickname("O'Brien")).toMatchObject({ ok: true });
    expect(validateNickname('Ana-Maria')).toMatchObject({ ok: true });
    expect(validateNickname('José')).toMatchObject({ ok: true });
    expect(validateNickname('さくら')).toMatchObject({ ok: true });
  });

  it('rejects a duplicate nickname regardless of case or padding', () => {
    const taken = ['Sunny Owl'];
    expect(validateNickname('sunny owl', { taken })).toMatchObject({
      ok: false,
      reason: 'duplicate',
    });
    expect(validateNickname('  SUNNY OWL', { taken })).toMatchObject({ ok: false, reason: 'duplicate' });
    expect(validateNickname('Sunny Owl 2', { taken })).toMatchObject({ ok: true });
  });

  it('never leaks the blocked word back in the message', () => {
    const result = validateNickname('shithead');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.toLowerCase()).not.toContain('shit');
  });
});

describe('containsProfanity', () => {
  it('blocks plain profanity', () => {
    for (const word of ['fuck', 'bitch', 'nigger', 'penis', 'whore']) {
      expect(containsProfanity(word), word).toBe(true);
    }
  });

  it('blocks leetspeak and padded spellings', () => {
    for (const word of ['f u c k', 'sh1t', 'b!tch', 'fuuuuck', 'a$$hole', 'PUSSY', 'p.o.r.n']) {
      expect(containsProfanity(word), word).toBe(true);
    }
  });

  it('blocks Filipino profanity the classroom is likely to see', () => {
    for (const word of ['tangina', 'putangina', 'gago']) {
      expect(containsProfanity(word), word).toBe(true);
    }
  });

  // The Scunthorpe problem: short terms must not match inside innocent names.
  it('allows innocent names that merely contain a blocked substring', () => {
    for (const word of ['Cassie', 'Scunthorpe', 'Classic', 'Grape', 'Shelly', 'Bassist', 'Titan']) {
      expect(containsProfanity(word), word).toBe(false);
    }
  });

  // Leet-mapping digits used to fold "Player 45" into "...as" and block it.
  it('allows numbered nicknames, which is how a class usually joins', () => {
    for (let i = 0; i < 60; i += 1) {
      expect(containsProfanity(`Player ${i}`), `Player ${i}`).toBe(false);
    }
    expect(containsProfanity('Team 45')).toBe(false);
    expect(containsProfanity('Owl 2000')).toBe(false);
  });

  it('allows ordinary kid nicknames', () => {
    for (const word of ['Ace', 'Blue Panda', 'Mr. Fox', 'Zara7', 'Owl Queen']) {
      expect(containsProfanity(word), word).toBe(false);
    }
  });
});

describe('normalizeForFilter', () => {
  it('folds accents, leet characters, separators and repeats', () => {
    expect(normalizeForFilter('Jösé')).toBe('jose');
    expect(normalizeForFilter('s-h-1-t')).toBe('shit');
    expect(normalizeForFilter('aaabbb')).toBe('ab');
  });
});
