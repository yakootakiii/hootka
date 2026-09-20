import {
  ANSWER_WINDOW_MS,
  MAX_PLAYERS,
  applyQuestionResults,
  buildQuestionResult,
  canAcceptAnswer,
  nextAdvance,
  scoreQuestion,
  toPublicQuestion,
  validateNickname,
  type AnswerRejection,
  type AnswerSubmission,
  type GameState,
  type Player,
  type PublicQuestion,
  type Question,
  type QuestionResult,
} from '@hootka/core';

/**
 * An in-memory stand-in for the Realtime Database plus the Cloud Functions.
 *
 * It runs the exact core modules the deployed functions run (`canAcceptAnswer`,
 * `scoreQuestion`, `applyQuestionResults`, `nextAdvance`, `toPublicQuestion`),
 * with the database reads and writes replaced by plain objects, so a whole game
 * can be played in a test without the emulator. What this cannot cover
 * (security rules, real latency) is checked by tests/load against the emulator.
 */
export class GameSim {
  readonly questions: Question[];
  readonly players = new Map<string, Player>();
  readonly answers = new Map<number, Map<string, AnswerSubmission>>();
  readonly results = new Map<number, QuestionResult>();
  readonly streakBonus: boolean;

  state: GameState;
  publicQuestion: PublicQuestion | null = null;
  /** Simulated server clock; tests move it forward explicitly. */
  now = 1_700_000_000_000;

  constructor(questions: Question[], options: { streakBonus?: boolean } = {}) {
    this.questions = questions;
    this.streakBonus = options.streakBonus ?? false;
    this.state = {
      phase: 'LOBBY',
      questionIndex: 0,
      questionStartedAt: null,
      totalQuestions: questions.length,
    };
  }

  tick(ms: number) {
    this.now += ms;
    return this.now;
  }

  join(
    uid: string,
    name: string,
  ): { ok: true; name: string; rejoined: boolean } | { ok: false; reason: string } {
    const existing = this.players.get(uid);
    if (existing) return { ok: true, name: existing.name, rejoined: true };

    if (this.state.phase !== 'LOBBY') return { ok: false, reason: 'game_started' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, reason: 'full' };

    const check = validateNickname(name, {
      taken: [...this.players.values()].map((player) => player.name),
    });
    if (!check.ok) return { ok: false, reason: check.reason };

    this.players.set(uid, {
      uid,
      name: check.name,
      joinedAt: this.now,
      score: 0,
      streak: 0,
      rank: 0,
      prevRank: 0,
      lastPoints: 0,
      correctCount: 0,
      totalResponseMs: 0,
      answeredCount: 0,
      connected: true,
    });
    return { ok: true, name: check.name, rejoined: false };
  }

  kick(uid: string) {
    this.players.delete(uid);
  }

  submit(uid: string, choice: number): { ok: true } | { ok: false; reason: AnswerRejection } {
    const index = this.state.questionIndex;
    const bucket = this.answers.get(index) ?? new Map<string, AnswerSubmission>();

    const decision = canAcceptAnswer({
      phase: this.state.phase,
      currentQuestionIndex: index,
      questionStartedAt: this.state.questionStartedAt,
      questionIndex: index,
      choice,
      optionCount: this.publicQuestion?.options.length ?? 0,
      now: this.now,
      isPlayer: this.players.has(uid),
      hasAnswered: bucket.has(uid),
    });
    if (!decision.ok) return decision;

    bucket.set(uid, { playerUid: uid, choice, answeredAt: this.now });
    this.answers.set(index, bucket);
    return { ok: true };
  }

  /** Mirrors `closeQuestionFor`, including its idempotency. */
  closeQuestion(index = this.state.questionIndex) {
    if (this.results.has(index)) return { alreadyClosed: true as const };

    const question = this.questions[index];
    if (!question) throw new Error(`no question at index ${index}`);
    if (this.state.questionStartedAt == null) throw new Error('question never opened');

    const players = [...this.players.values()];
    const { scored, counts } = scoreQuestion({
      submissions: [...(this.answers.get(index)?.values() ?? [])],
      correctIndex: question.correctIndex,
      questionStartedAt: this.state.questionStartedAt,
      timeLimitMs: (question.timeLimit ?? 10) * 1000,
      optionCount: question.options.length,
      streaks: Object.fromEntries(players.map((player) => [player.uid, player.streak])),
      streakBonusEnabled: this.streakBonus,
    });

    this.results.set(index, buildQuestionResult(question.correctIndex, counts, scored));
    for (const player of applyQuestionResults({ players, scored })) {
      this.players.set(player.uid, player);
    }
    return { alreadyClosed: false as const, scored };
  }

  /** Mirrors `advanceGame`, including the implicit close on leaving a question. */
  advance(options: { skip?: boolean } = {}) {
    const action = nextAdvance({ state: this.state, skip: options.skip });
    if (action.type === 'noop') return action;

    if (this.state.phase === 'QUESTION_ACTIVE') this.closeQuestion(this.state.questionIndex);

    this.state = { ...this.state, phase: action.phase, questionIndex: action.questionIndex };

    if (action.phase === 'QUESTION_INTRO') {
      const question = this.questions[action.questionIndex];
      this.publicQuestion = question ? toPublicQuestion(question) : null;
      this.state.questionStartedAt = null;
    }
    if (action.openWindow) this.state.questionStartedAt = this.now;
    if (action.phase === 'ENDED') this.publicQuestion = null;

    return action;
  }

  /** Run through intro to an open answer window in one step. */
  openNextQuestion() {
    if (this.state.phase === 'LOBBY' || this.state.phase === 'LEADERBOARD') this.advance();
    if (this.state.phase === 'QUESTION_INTRO') this.advance();
    return this.state;
  }

  leaderboard(): Player[] {
    return [...this.players.values()].sort((a, b) => a.rank - b.rank);
  }

  player(uid: string): Player {
    const found = this.players.get(uid);
    if (!found) throw new Error(`no player ${uid}`);
    return found;
  }
}

export const ANSWER_WINDOW = ANSWER_WINDOW_MS;

export function makeQuestions(count: number): Question[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `q${index}`,
    order: index,
    text: `Question ${index + 1}?`,
    imageUrl: null,
    timeLimit: 10,
    options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
    correctIndex: index % 4,
  }));
}
