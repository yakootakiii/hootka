/** Small formatting helpers shared by the host and player screens. */

export function formatPoints(points: number): string {
  return points.toLocaleString('en-US');
}

/** "123456" -> "123 456", which is far easier to read off a projector. */
export function formatGameCode(code: string): string {
  return code.replace(/(\d{3})(\d{3})/, '$1 $2');
}

/** 1 -> "1st", 11 -> "11th", 23 -> "23rd". Used for the speed badge. */
export function ordinal(n: number): string {
  const lastTwo = Math.abs(n) % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  const last = Math.abs(n) % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

/** Encouraging copy: the spec asks that a low rank is never shamed. */
export function feedbackHeadline(correct: boolean, points: number): string {
  if (correct && points >= 900) return 'Lightning fast!';
  if (correct && points >= 700) return 'Nice one!';
  if (correct) return 'Correct!';
  return 'Not this time!';
}

export function feedbackSubline(correct: boolean, streak: number): string {
  if (correct && streak >= 3) return `${streak} in a row!`;
  if (correct) return 'Keep it going.';
  return 'Good try - the next one is yours.';
}
