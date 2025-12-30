import type * as Party from "partykit/server";
import type {
  GameState,
  GamePhase,
  Player,
  Answer,
  Question,
  ClientMessage,
  ServerMessage,
  GameConfig,
  RoundResult,
} from "../lib/game-types";
import { DEFAULT_CONFIG, SCORING } from "../lib/game-types";
import { fetchTriviaQuestions, fetchSingleQuestion } from "../lib/trivia";
import { generateFakeAnswer } from "../lib/claude";
import {
  generateId,
  generateRoomCode,
  shuffleArray,
} from "../lib/fuzzy-match";
import { validatePlayerAnswer } from "../lib/validation";

// Initial game state factory
function createInitialState(roomCode: string): GameState {
  return {
    phase: "lobby",
    roomCode,
    players: [],
    config: { ...DEFAULT_CONFIG },
    currentRound: 0,
    currentQuestion: null,
    answers: [],
    timeRemaining: 0,
    roundResults: [],
  };
}



export default class FibbageServer implements Party.Server {
  state: GameState;
  questions: Question[] = [];
  timer: ReturnType<typeof setInterval> | null = null;
  nextQuestionPromise: Promise<Question> | null = null; // Background pre-fetch

  constructor(readonly room: Party.Room) {
    // Generate room code from room ID or create new one
    const roomCode = room.id.length === 4 ? room.id.toUpperCase() : generateRoomCode();
    this.state = createInitialState(roomCode);
  }

  // Normalize answer text to UPPERCASE so all answers look uniform and hide typing differences
  private normalizeAnswerCase(text: string): string {
    if (!text || text.trim().length === 0) {
      // this.broadcastLog('[FibbageServer] normalizeAnswerCase: Empty input');
      return text;
    }
    const normalized = text.trim().toUpperCase();
    this.broadcastLog(`[FibbageServer] normalizeAnswerCase: "${text}" -> "${normalized}"`);
    return normalized;
  }

  // Broadcast state to all connected clients
  broadcastState() {
    const message: ServerMessage = { type: "state-update", state: this.state };
    this.room.broadcast(JSON.stringify(message));
  }

  // Helper to send logs to client console for debugging
  broadcastLog(text: string, data?: any) {
    console.log(text, data || '');
    const message: ServerMessage = { type: "debug-log", message: text, data };
    this.room.broadcast(JSON.stringify(message));
  }

  // Send error to specific connection
  sendError(conn: Party.Connection, message: string) {
    const error: ServerMessage = { type: "error", message };
    conn.send(JSON.stringify(error));
  }

  // Handle new connections
  onConnect(conn: Party.Connection) {
    // Send current state to newly connected client
    const message: ServerMessage = { type: "state-update", state: this.state };
    conn.send(JSON.stringify(message));
  }

  // Handle disconnections - SOFT DISCONNECT
  onClose(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.id === conn.id);
    if (player) {
      player.isOnline = false;
      // We don't remove the player, just mark offline so they can reconnect
      this.broadcastState();
    }
  }

  // Handle incoming messages
  async onMessage(message: string, sender: Party.Connection) {
    try {
      const data: ClientMessage = JSON.parse(message);

      switch (data.type) {
        case "join":
          this.handleJoin(sender, data.name, data.isHost);
          break;
        case "start-game":
          await this.handleStartGame(sender, data.config);
          break;
        case "submit-answer":
          this.handleSubmitAnswer(sender, data.answer);
          break;
        case "submit-vote":
          this.handleSubmitVote(sender, data.answerId);
          break;
        case "next-round":
          await this.handleNextRound(sender);
          break;
        case "play-again":
          this.handlePlayAgain(sender);
          break;
        case "leave":
          this.handleLeave(sender);
          break;
      }
    } catch (error) {
      console.error("Error processing message:", error);
      this.sendError(sender, "Failed to process message");
    }
  }

  // Handle player joining
  handleJoin(conn: Party.Connection, name: string, isHost?: boolean) {
    // Check if player already exists by ID (re-connection from same socket?)
    const existingPlayerById = this.state.players.find((p) => p.id === conn.id);
    if (existingPlayerById) {
      existingPlayerById.name = name.trim().substring(0, 20);
      existingPlayerById.isHost = isHost || existingPlayerById.isHost;
      existingPlayerById.isOnline = true;
      this.broadcastState();
      return;
    }

    // Check for existing player by NAME (Recovery/Reconnection)
    const existingPlayerByName = this.state.players.find(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (existingPlayerByName) {
      if (!existingPlayerByName.isOnline) {
        // RECONNECT: Update ID to new connection and mark online
        this.broadcastLog(`[FibbageServer] Player "${name}" reconnecting (old id: ${existingPlayerByName.id} -> new: ${conn.id})`);
        existingPlayerByName.id = conn.id;
        existingPlayerByName.isOnline = true;

        this.broadcastState();
        return;
      } else {
        // Name taken and "online" - Check if we should steal the session
        // This handles race conditions where refresh happens fast (new join before old close)
        // OR simply logging in from a new device/tab

        this.broadcastLog(`[FibbageServer] Session steal for "${name}" (old: ${existingPlayerByName.id} -> new: ${conn.id})`);

        // Close old connection if it exists
        const oldConn = this.room.getConnection(existingPlayerByName.id);
        if (oldConn) {
          oldConn.close();
        }

        // Take over session
        existingPlayerByName.id = conn.id;
        existingPlayerByName.isOnline = true;

        this.broadcastState();
        return;
      }
    }

    // Check if game is in progress
    if (this.state.phase !== "lobby") {
      this.sendError(conn, "Game already in progress");
      conn.close();
      return;
    }

    // Check if room has a host (unless this join request is establishing the host)
    const hasHost = this.state.players.some(p => p.isHost);
    if (!isHost && !hasHost) {
      this.sendError(conn, "Room not found or not active");
      conn.close();
      return;
    }

    // Check player limit (max 8 players, excluding host)
    const currentPlayers = this.state.players.filter(p => !p.isHost).length;
    if (!isHost && currentPlayers >= 8) {
      this.sendError(conn, "Room is full (max 8 players)");
      conn.close();
      return;
    }

    // Check for duplicate names (already handled above, but double check)
    if (this.state.players.find((p) => p.name.toLowerCase() === name.toLowerCase())) {
      this.sendError(conn, "Name already taken");
      return;
    }

    const player: Player = {
      id: conn.id,
      name: name.trim().substring(0, 20),
      score: 0,
      isHost: isHost || this.state.players.length === 0,
      hasSubmittedAnswer: false,
      hasVoted: false,
      isOnline: true,
    };

    this.state.players.push(player);

    const joinedMessage: ServerMessage = { type: "player-joined", player };
    this.room.broadcast(JSON.stringify(joinedMessage));
    this.broadcastState();
  }

  // Handle game start
  async handleStartGame(conn: Party.Connection, config: GameConfig) {
    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player?.isHost) {
      this.sendError(conn, "Only the host can start the game");
      return;
    }

    const playerCount = this.state.players.filter(p => !p.isHost).length;
    if (playerCount < 2) {
      this.sendError(conn, "Need at least 2 players to start");
      return;
    }

    // Apply config
    this.state.config = {
      totalRounds: Math.min(Math.max(config.totalRounds, 1), 15),
      answerTimeSeconds: Math.min(Math.max(config.answerTimeSeconds, 15), 180),
      votingTimeSeconds: Math.min(Math.max(config.votingTimeSeconds, 15), 120),
      aiAnswerCount: Math.min(Math.max(config.aiAnswerCount ?? 1, 0), 5),
    };

    // Show loading phase while fetching first question
    this.state.phase = "loading";
    this.broadcastState();

    // Fetch only the first question (on-demand)
    const firstQuestion = await fetchSingleQuestion(
      this.room.env.ANTHROPIC_API_KEY as string,
      []
    );
    this.questions = [firstQuestion];

    // Start first round
    await this.startRound();
  }

  // Start a new round
  async startRound() {
    this.state.currentRound++;
    this.state.answers = [];

    // Reset player states
    this.state.players.forEach((p) => {
      p.hasSubmittedAnswer = false;
      p.hasVoted = false;
      p.currentAnswer = undefined;
      p.votedFor = undefined;
    });

    // Get next question - check if we have one pre-fetched
    let question = this.questions.shift();

    // If no question in queue, wait for pre-fetched one or fetch new one
    if (!question) {
      if (this.nextQuestionPromise) {
        // Show loading while waiting for pre-fetched question
        this.state.phase = "loading";
        this.broadcastState();
        question = await this.nextQuestionPromise;
        this.nextQuestionPromise = null;
      } else {
        // No pre-fetch, fetch one now with loading screen
        this.state.phase = "loading";
        this.broadcastState();
        question = await fetchSingleQuestion(
          this.room.env.ANTHROPIC_API_KEY as string,
          this.state.currentQuestion ? [this.state.currentQuestion.text] : []
        );
      }
    }

    if (!question) {
      this.endGame();
      return;
    }

    this.state.currentQuestion = question;
    this.state.phase = "question";
    this.broadcastState();

    // Pre-fetch next question in background if not last round
    if (this.state.currentRound < this.state.config.totalRounds) {
      this.nextQuestionPromise = fetchSingleQuestion(
        this.room.env.ANTHROPIC_API_KEY as string,
        [question.text]
      );
    }

    // Brief pause to show question, then move to answering
    setTimeout(() => {
      this.startAnsweringPhase();
    }, 3000);
  }

  // Start the answering phase
  startAnsweringPhase() {
    this.state.phase = "answering";
    this.state.timeRemaining = this.state.config.answerTimeSeconds;
    this.broadcastState();

    // Broadcast time immediately
    const timeMessage: ServerMessage = { type: "time-update", timeRemaining: this.state.config.answerTimeSeconds };
    this.room.broadcast(JSON.stringify(timeMessage));

    // Start countdown timer
    this.startTimer(() => {
      this.endAnsweringPhase();
    }, this.state.config.answerTimeSeconds);
  }

  // Handle answer submission with enhanced RAG validation
  async handleSubmitAnswer(conn: Party.Connection, answer: string) {
    if (this.state.phase !== "answering") {
      this.sendError(conn, "Not in answering phase");
      return;
    }

    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player) {
      this.sendError(conn, "Player not found");
      return;
    }

    if (player.hasSubmittedAnswer) {
      this.sendError(conn, "Already submitted an answer");
      return;
    }

    // Enhanced validation with RAG (fuzzy match + semantic + Wikipedia)
    if (this.state.currentQuestion) {
      try {
        const validation = await validatePlayerAnswer(
          answer,
          this.state.currentQuestion
        );
        if (!validation.isValid) {
          this.sendError(conn, validation.reason);
          return;
        }
      } catch (error) {
        console.warn('Validation error, falling back to basic check:', error);
        // Basic fallback if RAG validation fails
      }
    }

    player.currentAnswer = answer.trim().substring(0, 100);
    player.hasSubmittedAnswer = true;

    this.broadcastState();

    // Check if all ONLINE players (except host) have submitted
    const onlinePlayers = this.state.players.filter(p => !p.isHost && p.isOnline);
    if (onlinePlayers.length > 0 && onlinePlayers.every((p) => p.hasSubmittedAnswer)) {
      this.stopTimer();
      this.endAnsweringPhase();
    }
  }

  // End answering phase and start voting
  async endAnsweringPhase() {
    this.stopTimer();

    if (!this.state.currentQuestion) return;

    // Collect all answers
    const answers: Answer[] = [];

    // Add player answers (normalized to Title Case)
    this.state.players.forEach((p) => {
      if (p.currentAnswer) {
        answers.push({
          id: generateId(),
          text: this.normalizeAnswerCase(p.currentAnswer),
          playerId: p.id,
          isCorrect: false,
          isAI: false,
          votes: [],
        });
      }
    });

    // Generate AI fake answers in PARALLEL (much faster than sequential)
    const aiAnswerCount = this.state.config.aiAnswerCount ?? 1;
    console.log(`[FibbageServer] Generating ${aiAnswerCount} AI answers in parallel...`);

    if (aiAnswerCount > 0) {
      const aiPromises = Array.from({ length: aiAnswerCount }, (_, i) =>
        generateFakeAnswer(this.state.currentQuestion!, this.room.env.ANTHROPIC_API_KEY as string)
          .then(aiAnswer => {
            console.log(`[FibbageServer] Generated AI answer ${i + 1}: "${aiAnswer}"`);
            return aiAnswer;
          })
          .catch(error => {
            console.error(`[FibbageServer] Failed to generate AI answer ${i + 1}:`, error);
            return null;
          })
      );

      const aiResults = await Promise.allSettled(aiPromises);

      aiResults.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
          const aiAnswer = result.value;
          // Check for duplicates (compare normalized versions)
          const normalizedAI = this.normalizeAnswerCase(aiAnswer);
          const isDuplicate = answers.some(a => a.text.toLowerCase() === normalizedAI.toLowerCase());
          if (!isDuplicate) {
            answers.push({
              id: generateId(),
              text: normalizedAI,
              playerId: null,
              isCorrect: false,
              isAI: true,
              votes: [],
            });
          } else {
            console.log(`[FibbageServer] AI answer ${i + 1} was duplicate, skipping`);
          }
        }
      });

      // Add fallback if no AI answers were generated
      // Add fallback if no AI answers were generated
      if (!answers.some(a => a.isAI)) {
        answers.push({
          id: generateId(),
          text: this.normalizeAnswerCase("Unknown"),
          playerId: null,
          isCorrect: false,
          isAI: true,
          votes: [],
        });
      }
    }

    console.log(`[FibbageServer] Total AI answers generated: ${answers.filter(a => a.isAI).length}`);

    // Add correct answer (normalized)
    answers.push({
      id: generateId(),
      text: this.normalizeAnswerCase(this.state.currentQuestion.correctAnswer),
      playerId: null,
      isCorrect: true,
      isAI: false,
      votes: [],
    });

    // Shuffle answers
    this.state.answers = shuffleArray(answers);

    // Start voting phase
    this.state.phase = "voting";
    this.state.timeRemaining = this.state.config.votingTimeSeconds;

    // Log ALL answers to verify normalization
    this.broadcastLog('[FibbageServer] Starting voting with answers:', JSON.stringify(this.state.answers.map(a => ({ text: a.text, isAI: a.isAI })), null, 2));

    this.broadcastState();

    // Broadcast time immediately
    const timeMessage: ServerMessage = { type: "time-update", timeRemaining: this.state.config.votingTimeSeconds };
    this.room.broadcast(JSON.stringify(timeMessage));

    this.startTimer(() => {
      this.endVotingPhase();
    }, this.state.config.votingTimeSeconds);
  }

  // Handle vote submission
  handleSubmitVote(conn: Party.Connection, answerId: string) {
    if (this.state.phase !== "voting") {
      this.sendError(conn, "Not in voting phase");
      return;
    }

    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player) {
      this.sendError(conn, "Player not found");
      return;
    }

    if (player.hasVoted) {
      this.sendError(conn, "Already voted");
      return;
    }

    // Can't vote for own answer
    const answer = this.state.answers.find((a) => a.id === answerId);
    if (!answer) {
      this.sendError(conn, "Answer not found");
      return;
    }

    if (answer.playerId === conn.id) {
      this.sendError(conn, "Cannot vote for your own answer");
      return;
    }

    // Record vote
    player.hasVoted = true;
    player.votedFor = answerId;
    answer.votes.push(conn.id);

    this.broadcastState();

    // Check if all ONLINE players (except host) have voted
    const onlinePlayers = this.state.players.filter(p => !p.isHost && p.isOnline);
    if (onlinePlayers.length > 0 && onlinePlayers.every((p) => p.hasVoted)) {
      this.stopTimer();
      this.endVotingPhase();
    }
  }

  // End voting and calculate scores
  endVotingPhase() {
    this.stopTimer();

    const roundScores: { playerId: string; pointsEarned: number; reason: string }[] = [];

    // Calculate scores (only for non-host players)
    this.state.players.filter(p => !p.isHost).forEach((player) => {
      let points = 0;
      let reasons: string[] = [];

      // Check if they voted for the correct answer
      const votedAnswer = this.state.answers.find((a) => a.id === player.votedFor);
      if (votedAnswer?.isCorrect) {
        points += SCORING.CORRECT_GUESS;
        reasons.push("Found the truth!");
      }

      // Check if anyone voted for this player's answer
      const playerAnswer = this.state.answers.find((a) => a.playerId === player.id);
      if (playerAnswer) {
        const fooledCount = playerAnswer.votes.length;
        if (fooledCount > 0) {
          points += fooledCount * SCORING.FOOL_PLAYER;
          reasons.push("Fooled " + fooledCount + " player" + (fooledCount > 1 ? "s" : "") + "!");
        }
      }

      player.score += points;
      roundScores.push({
        playerId: player.id,
        pointsEarned: points,
        reason: reasons.join(" ") || "No points this round",
      });
    });

    // Store round results
    if (this.state.currentQuestion) {
      const aiAnswer = this.state.answers.find((a) => a.isAI);
      this.state.roundResults.push({
        round: this.state.currentRound,
        question: this.state.currentQuestion,
        correctAnswer: this.state.currentQuestion.correctAnswer,
        aiAnswer: aiAnswer?.text || "",
        playerAnswers: this.state.players
          .filter((p) => p.currentAnswer)
          .map((p) => ({ playerId: p.id, answer: p.currentAnswer! })),
        votes: this.state.players
          .filter((p) => p.votedFor)
          .map((p) => ({ playerId: p.id, votedForAnswerId: p.votedFor! })),
        scores: roundScores,
      });
    }

    this.state.phase = "results";
    this.state.timeRemaining = 0; // No auto-advance - host clicks "Next Round" to continue
    this.broadcastState();
    // Removed auto-timer to prevent race conditions with manual "Next Round" clicks
  }

  // Handle next round request
  async handleNextRound(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player?.isHost) {
      this.sendError(conn, "Only the host can advance rounds");
      return;
    }

    // Stop any running timers to prevent race conditions
    this.stopTimer();

    // Only allow advancing from results phase
    if (this.state.phase !== "results") {
      this.sendError(conn, "Cannot advance - not in results phase");
      return;
    }

    if (this.state.currentRound >= this.state.config.totalRounds) {
      this.endGame();
    } else {
      await this.startRound();
    }
  }

  // End the game
  endGame() {
    this.stopTimer();
    this.state.phase = "game-over";
    this.broadcastState();
  }

  // Handle play again
  handlePlayAgain(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player?.isHost) {
      this.sendError(conn, "Only the host can restart the game");
      return;
    }

    // Reset game state but keep players
    const players = this.state.players.map((p) => ({
      ...p,
      score: 0,
      hasSubmittedAnswer: false,
      hasVoted: false,
      currentAnswer: undefined,
      votedFor: undefined,
    }));

    this.state = createInitialState(this.state.roomCode);
    this.state.players = players;
    this.questions = [];

    this.broadcastState();
  }

  // Handle player leaving (Explicit LEAVE button) - HARD DISCONNECT
  handleLeave(conn: Party.Connection) {
    this.state.players = this.state.players.filter((p) => p.id !== conn.id);

    // If host left, assign new host
    if (this.state.players.length > 0 && !this.state.players.some((p) => p.isHost)) {
      this.state.players[0].isHost = true;
    }

    const leftMessage: ServerMessage = { type: "player-left", playerId: conn.id };
    this.room.broadcast(JSON.stringify(leftMessage));
    this.broadcastState();
  }

  // Timer utilities
  startTimer(callback: () => void, seconds: number) {
    this.stopTimer();

    const endTime = Date.now() + seconds * 1000;

    this.timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      this.state.timeRemaining = remaining;

      const timeMessage: ServerMessage = { type: "time-update", timeRemaining: remaining };
      this.room.broadcast(JSON.stringify(timeMessage));

      if (remaining <= 0) {
        this.stopTimer();
        callback();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
