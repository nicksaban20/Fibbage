// Game phase states
export type GamePhase =
  | 'lobby'
  | 'loading'
  | 'question'
  | 'answering'
  | 'voting'
  | 'results'
  | 'game-over';

// Player interface
export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  hasSubmittedAnswer: boolean;
  hasVoted: boolean;
  currentAnswer?: string;
  votedFor?: string;
  isOnline: boolean;
}

// Answer with metadata
export interface Answer {
  id: string;
  text: string;
  playerId: string | null; // null for AI or correct answer
  isCorrect: boolean;
  isAI: boolean;
  votes: string[]; // Player IDs who voted for this
}

// Trivia question structure
export interface Question {
  id: string;
  text: string;
  correctAnswer: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source?: 'claude' | 'opentdb' | 'static';
}

// Game configuration (set by host)
export interface GameConfig {
  totalRounds: number;
  answerTimeSeconds: number;
  votingTimeSeconds: number;
  aiAnswerCount: number; // Number of AI-generated fake answers per round
  verifyAnswers: boolean;
}

// Full game state
export interface GameState {
  phase: GamePhase;
  roomCode: string;
  players: Player[];
  config: GameConfig;
  currentRound: number;
  currentQuestion: Question | null;
  answers: Answer[];
  timeRemaining: number;
  roundResults: RoundResult[];
}

// Results for a single round
export interface RoundResult {
  round: number;
  question: Question;
  correctAnswer: string;
  aiAnswer: string;
  playerAnswers: { playerId: string; answer: string }[];
  votes: { playerId: string; votedForAnswerId: string }[];
  scores: { playerId: string; pointsEarned: number; reason: string }[];
}

// WebSocket message types
export type ClientMessage =
  | { type: 'join'; name: string; isHost?: boolean }
  | { type: 'start-game'; config: GameConfig }
  | { type: 'submit-answer'; answer: string }
  | { type: 'submit-vote'; answerId: string }
  | { type: 'next-round' }
  | { type: 'play-again' }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'state-update'; state: GameState }
  | { type: 'error'; message: string }
  | { type: 'player-joined'; player: Player }
  | { type: 'player-left'; playerId: string }
  | { type: 'time-update'; timeRemaining: number }
  | { type: 'phase-change'; phase: GamePhase }
  | { type: 'debug-log'; message: string; data?: any };

// Default game configuration
export const DEFAULT_CONFIG: GameConfig = {
  totalRounds: 5,
  answerTimeSeconds: 60,
  votingTimeSeconds: 45,
  aiAnswerCount: 1,
  verifyAnswers: false,
};

// Scoring constants
export const SCORING = {
  CORRECT_GUESS: 1000,
  FOOL_PLAYER: 500,
  AI_VOTE: 0 // No penalty for voting for AI
};
