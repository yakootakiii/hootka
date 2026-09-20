/** Shared domain types for Hootka. Used by the web app, the Cloud Functions and the tests. */

/** How long players get to answer a question, in milliseconds. */
export const ANSWER_WINDOW_MS = 10_000;

/** Extra slack for network latency before a late answer is rejected. */
export const LATE_GRACE_MS = 1_000;

/** "Get ready!" countdown before the answer window opens. */
export const INTRO_MS = 3_000;

/** Points awarded for an instantaneous correct answer. */
export const MAX_POINTS = 1000;

/** Hard cap on players per game (design target 40-50, headroom to 60). */
export const MAX_PLAYERS = 60;

/** Nicknames longer than this are rejected. */
export const MAX_NICKNAME_LENGTH = 15;

/** Answers must have between 2 and 4 options. */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;

export type GamePhase =
  | 'LOBBY'
  | 'QUESTION_INTRO'
  | 'QUESTION_ACTIVE'
  | 'QUESTION_RESULT'
  | 'LEADERBOARD'
  | 'FINAL_PODIUM'
  | 'ENDED';

export type GameStatus = 'open' | 'running' | 'ended';

export interface QuizOption {
  text: string;
}

/** A question as stored in Firestore, including the answer. Never sent to players. */
export interface Question {
  id: string;
  order: number;
  text: string;
  imageUrl?: string | null;
  timeLimit: number;
  options: QuizOption[];
  correctIndex: number;
}

/** The redacted view of a question that is safe to publish to players. */
export interface PublicQuestion {
  text: string;
  imageUrl?: string | null;
  options: QuizOption[];
}

export interface Quiz {
  id: string;
  ownerUid: string;
  title: string;
  coverImageUrl?: string | null;
  questionCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface GameSettings {
  /** +50 per consecutive correct answer, capped at +200. Off by default. */
  streakBonus: boolean;
}

export interface GameMeta {
  hostUid: string;
  quizId: string;
  code: string;
  status: GameStatus;
  createdAt: number;
  endedAt?: number | null;
  settings: GameSettings;
}

export interface GameState {
  phase: GamePhase;
  questionIndex: number;
  /** Server timestamp (ms) at which the answer window opened. */
  questionStartedAt: number | null;
  totalQuestions: number;
}

export interface Player {
  uid: string;
  name: string;
  joinedAt: number;
  score: number;
  streak: number;
  rank: number;
  prevRank: number;
  lastPoints: number;
  correctCount: number;
  /** Sum of response times (ms) over answered questions, for the CSV export. */
  totalResponseMs: number;
  answeredCount: number;
  connected?: boolean;
}

/** A raw submission as written by `submitAnswer`, before scoring. */
export interface AnswerSubmission {
  playerUid: string;
  choice: number;
  /** Server timestamp (ms) at which the answer arrived. */
  answeredAt: number;
}

/** A submission after `closeQuestion` has scored it. */
export interface ScoredAnswer extends AnswerSubmission {
  correct: boolean;
  points: number;
  /** 1 = fastest submission of this question. */
  order: number;
  responseMs: number;
}

export interface QuestionResult {
  correctIndex: number;
  counts: number[];
  answeredCount: number;
}

export type RankChange = 'up' | 'down' | 'same' | 'new';

export interface LeaderboardEntry {
  uid: string;
  name: string;
  score: number;
  rank: number;
  prevRank: number;
  change: RankChange;
  lastPoints: number;
  streak: number;
}
