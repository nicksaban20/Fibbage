// Game phase states
export type GamePhase =
  | 'lobby'
  | 'loading'
  | 'question'
  | 'answering'
  | 'voting'
  | 'results'
  | 'game-over'
  // Quiplash-specific phases
  | 'quiplash-answering'
  | 'quiplash-voting'
  | 'quiplash-results';

// Game mode
export type GameMode = 'fibbage' | 'quiplash';

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
  // Quiplash: player's assigned prompts
  quiplashPrompts?: QuiplashPrompt[];
  quiplashAnswers?: { promptId: string; answer: string }[];
}

// Answer with metadata
export interface Answer {
  id: string;
  text: string;
  playerIds: string[]; // List of players who submitted this answer (empty for AI/Correct)
  isCorrect: boolean;
  isAI: boolean;
  votes: string[]; // Player IDs who voted for this
}

// Trivia question structure (Fibbage)
export interface Question {
  id: string;
  text: string;
  correctAnswer: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source?: 'claude' | 'opentdb' | 'static';
}

// Quiplash prompt
export interface QuiplashPrompt {
  id: string;
  text: string; // e.g., "The worst thing to say at a wedding"
  category?: string;
}

// Quiplash matchup (2 answers compete head-to-head)
export interface QuiplashMatchup {
  id: string;
  prompt: QuiplashPrompt;
  answers: {
    playerId: string;
    playerName: string;
    text: string;
    votes: string[]; // Player IDs who voted for this
  }[];
  hasBeenShown: boolean;
}

// Game configuration (set by host)
export interface GameConfig {
  gameMode: GameMode;
  totalRounds: number;
  answerTimeSeconds: number;
  votingTimeSeconds: number;
  // Fibbage-specific
  aiAnswerCount: number;
  verifyAnswers: boolean;
  model: string;
  useFallbackOnly: boolean;
}

// Full game state
export interface GameState {
  phase: GamePhase;
  roomCode: string;
  players: Player[];
  config: GameConfig;
  currentRound: number;
  // Fibbage
  currentQuestion: Question | null;
  answers: Answer[];
  // Quiplash
  quiplashMatchups: QuiplashMatchup[];
  currentMatchupIndex: number;
  // Shared
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
  | { type: 'leave' }
  | { type: 'kick-player'; playerId: string }
  | { type: 'skip-timer' }
  // Quiplash-specific
  | { type: 'submit-quiplash-answers'; answers: { promptId: string; answer: string }[] }
  | { type: 'submit-quiplash-vote'; matchupId: string; votedPlayerId: string }
  | { type: 'next-matchup' };

export type ServerMessage =
  | { type: 'state-update'; state: GameState }
  | { type: 'error'; message: string }
  | { type: 'player-joined'; player: Player }
  | { type: 'player-left'; playerId: string }
  | { type: 'time-update'; timeRemaining: number }
  | { type: 'phase-change'; phase: GamePhase }
  | { type: 'debug-log'; message: string; data?: unknown };

// Default game configuration
export const DEFAULT_CONFIG: GameConfig = {
  gameMode: 'fibbage',
  totalRounds: 5,
  answerTimeSeconds: 60,
  votingTimeSeconds: 45,
  aiAnswerCount: 1,
  verifyAnswers: false,
  model: 'claude-haiku-4-5-20251001',
  useFallbackOnly: false,
};

// Scoring constants
export const SCORING = {
  // Fibbage
  CORRECT_GUESS: 1000,
  FOOL_PLAYER: 1000,
  AI_VOTE: 0,
  // Quiplash
  QUIPLASH_WIN: 500,      // 100% votes ("Quiplash!")
  QUIPLASH_MAJORITY: 250, // >50% votes
  QUIPLASH_SPLIT: 125,    // 50-50 split
};
