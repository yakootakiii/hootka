export const GAME_CODE_LENGTH = 6;

const CODE_PATTERN = /^\d{6}$/;

/** Cryptographically random integer in [0, max). Falls back to Math.random. */
function randomInt(max: number): number {
  // Typed structurally so core stays free of DOM and Node lib dependencies.
  const globalCrypto = (globalThis as {
    crypto?: { getRandomValues?: (array: Uint32Array) => Uint32Array };
  }).crypto;
  if (globalCrypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    // Reject the tail of the range so every value stays equally likely.
    const limit = Math.floor(0xffffffff / max) * max;
    let value = 0;
    do {
      globalCrypto.getRandomValues(buffer);
      value = buffer[0] ?? 0;
    } while (value >= limit);
    return value % max;
  }
  return Math.floor(Math.random() * max);
}

/** A 6-digit game code, zero-padded so every code is the same width. */
export function generateGameCode(): string {
  return String(randomInt(1_000_000)).padStart(GAME_CODE_LENGTH, '0');
}

export function isValidGameCode(code: string): boolean {
  return CODE_PATTERN.test(String(code ?? '').trim());
}

/** Keep only digits so "123 456" and "123-456" both work when typed or pasted. */
export function normalizeGameCode(code: string): string {
  return String(code ?? '').replace(/\D/g, '').slice(0, GAME_CODE_LENGTH);
}
