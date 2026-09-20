import { MAX_NICKNAME_LENGTH } from './types.js';

export type NicknameRejection =
  | 'empty'
  | 'too_long'
  | 'invalid_characters'
  | 'profanity'
  | 'duplicate';

export type NicknameCheck =
  | { ok: true; name: string }
  | { ok: false; reason: NicknameRejection; message: string };

/**
 * Terms with no innocent English host, matched anywhere inside the name so that
 * "xXfuckXx" and "iamafuck" are both caught.
 */
const SUBSTRING_TERMS = [
  'asshole', 'bastard', 'bitch', 'blowjob', 'bollock', 'bullshit', 'clitoris',
  'cocksuck', 'cunnilingus', 'dickhead', 'dildo', 'douchebag', 'faggot',
  'fellatio', 'fuck', 'gangbang', 'handjob', 'hitler', 'jizz', 'masturbat',
  'motherfuck', 'nigga', 'nigger', 'orgasm', 'penis', 'porn', 'pussy', 'rapist',
  'retard', 'scrotum', 'shit', 'skank', 'slut', 'sperm', 'testicle', 'titties',
  'tranny', 'vagina', 'viagra', 'whore', 'putangina', 'tangina',
];

/**
 * Terms that live inside perfectly innocent words ("Scunthorpe", "Cassie",
 * "Sexton"), so they are only ever matched as a whole word.
 */
const WORD_TERMS = [
  'anal', 'anus', 'arse', 'ass', 'butt', 'cock', 'coon', 'crap', 'cum', 'cunt',
  'damn', 'dick', 'fag', 'hell', 'jerk', 'kkk', 'nazi', 'piss', 'poop', 'pube',
  'puta', 'semen', 'sex', 'suck', 'tit', 'twat', 'wank', 'bobo', 'gago', 'tanga',
];

const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '6': 'g',
  '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '+': 't',
};

/** Characters that can stand in for letters, so they must not split a token. */
const LEET_SYMBOLS = "0-9@$!+";

/** Lowercase and strip accents, leaving separators and leet symbols in place. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function unleet(value: string): string {
  return [...value].map((char) => LEET_MAP[char] ?? char).join('');
}

/** "fuuuuck" and "fuck" must fold to the same thing, so runs collapse to one. */
function collapseRuns(value: string): string {
  return value.replace(/(.)\1+/g, '$1');
}

/**
 * Split on anything that cannot stand in for a letter, so "a$$hole" stays one
 * token while "Player 45" becomes two.
 */
function splitTokens(value: string): string[] {
  return fold(value)
    .split(new RegExp(`[^a-z${LEET_SYMBOLS}]+`))
    .filter(Boolean);
}

/**
 * A run of two or more digits is a number, not disguised letters. Without this,
 * leet-mapping turns the "45" in "Player 45" into "as" and blocks it.
 */
function foldToken(token: string): string {
  if (/^[0-9]{2,}$/.test(token)) return token;
  return collapseRuns(unleet(token).replace(/[^a-z0-9]/g, ''));
}

/**
 * Fold a nickname to comparable letters: accents stripped, leet undone,
 * separators dropped, repeated letters collapsed. Blocked terms are folded the
 * same way before comparison, so "nigger" -> "niger" still matches.
 */
export function normalizeForFilter(value: string): string {
  return collapseRuns(splitTokens(value).map(foldToken).join(''));
}

function tokensForFilter(value: string): string[] {
  return splitTokens(value).map(foldToken).filter(Boolean);
}

const FOLDED_SUBSTRING_TERMS = SUBSTRING_TERMS.map(normalizeForFilter);
const FOLDED_WORD_TERMS = WORD_TERMS.map(normalizeForFilter);

export function containsProfanity(value: string): boolean {
  const collapsed = normalizeForFilter(value);
  if (!collapsed) return false;

  if (FOLDED_SUBSTRING_TERMS.some((term) => collapsed.includes(term))) return true;

  // Whole-word terms: match a token, or the entire name once separators are
  // stripped ("a s s"). Equality, never substring, keeps "Cassie" playable.
  const tokens = tokensForFilter(value);
  return FOLDED_WORD_TERMS.some(
    (term) => collapsed === term || tokens.includes(term),
  );
}

export interface ValidateNicknameOptions {
  /** Nicknames already taken in this game (compared case-insensitively). */
  taken?: readonly string[];
}

/**
 * Validate a player nickname: trimmed, 1-15 characters, printable, clean, and
 * not already used in the same game.
 */
export function validateNickname(
  raw: string,
  options: ValidateNicknameOptions = {},
): NicknameCheck {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();

  if (!name) {
    return { ok: false, reason: 'empty', message: 'Please type a nickname.' };
  }
  if ([...name].length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      reason: 'too_long',
      message: `Nicknames can be up to ${MAX_NICKNAME_LENGTH} characters.`,
    };
  }
  // Letters (any script), numbers, spaces and a few friendly punctuation marks.
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) {
    return {
      ok: false,
      reason: 'invalid_characters',
      message: 'Use letters, numbers and spaces only.',
    };
  }
  if (containsProfanity(name)) {
    return { ok: false, reason: 'profanity', message: 'Let us pick a kinder name!' };
  }

  const lowered = name.toLowerCase();
  if ((options.taken ?? []).some((existing) => existing.trim().toLowerCase() === lowered)) {
    return {
      ok: false,
      reason: 'duplicate',
      message: 'Someone already took that name. Try another!',
    };
  }

  return { ok: true, name };
}
