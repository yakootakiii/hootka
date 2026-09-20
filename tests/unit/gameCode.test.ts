import { describe, expect, it } from 'vitest';
import { GAME_CODE_LENGTH, generateGameCode, isValidGameCode, normalizeGameCode } from '@hootka/core';

describe('generateGameCode', () => {
  it('always produces six digits, including for small numbers', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateGameCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code).toHaveLength(GAME_CODE_LENGTH);
    }
  });

  it('spreads across the range rather than repeating one value', () => {
    const codes = new Set(Array.from({ length: 200 }, generateGameCode));
    expect(codes.size).toBeGreaterThan(150);
  });
});

describe('isValidGameCode', () => {
  it('accepts a six-digit code and rejects anything else', () => {
    expect(isValidGameCode('012345')).toBe(true);
    expect(isValidGameCode(' 123456 ')).toBe(true);
    expect(isValidGameCode('12345')).toBe(false);
    expect(isValidGameCode('1234567')).toBe(false);
    expect(isValidGameCode('12a456')).toBe(false);
    expect(isValidGameCode('')).toBe(false);
  });
});

describe('normalizeGameCode', () => {
  it('keeps only digits, capped at six', () => {
    expect(normalizeGameCode('123 456')).toBe('123456');
    expect(normalizeGameCode('123-456')).toBe('123456');
    expect(normalizeGameCode('1234567890')).toBe('123456');
    expect(normalizeGameCode('abc')).toBe('');
  });
});
