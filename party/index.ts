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
import { fetchTriviaQuestions } from "../lib/trivia";
import { generateFakeAnswer } from "../lib/claude";
import {
  generateId,
  generateRoomCode,
  shuffleArray,
  isTooSimilarToCorrect,
} from "../lib/fuzzy-match";

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

  constructor(readonly room: Party.Room) {
    // Generate room code from room ID or create new one
    const roomCode = room.id.length === 4 ? room.id.toUpperCase() : generateRoomCode();
    this.state = createInitialState(roomCode);
  }

  // Broadcast state to all connected clients
  broadcastState() {
    const message: ServerMessage = { type: "state-update", state: this.state };
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

  // Handle disconnections
  onClose(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.id === conn.id);
    if (player) {
      this.state.players = this.state.players.filter((p) => p.id !== conn.id);
      const leftMessage: ServerMessage = { type: "player-left", playerId: conn.id };
      this.room.broadcast(JSON.stringify(leftMessage));
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
    // Check if player already exists
    if (this.state.players.find((p) => p.id === conn.id)) {
      this.sendError(conn, "Already joined");
      return;
    }

    // Check if game is in progress
    if (this.state.phase !== "lobby") {
      this.sendError(conn, "Game already in progress");
      return;
    }

    // Check player limit
    if (this.state.players.length >= 8) {
      this.sendError(conn, "Room is full (max 8 players)");
      return;
    }

    // Check for duplicate names
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

    if (this.state.players.length < 2) {
      this.sendError(conn, "Need at least 2 players to start");
      return;
    }

    // Apply config
    this.state.config = {
      totalRounds: Math.min(Math.max(config.totalRounds, 1), 15),
      answerTimeSeconds: Math.min(Math.max(config.answerTimeSeconds, 15), 180),
      votingTimeSeconds: Math.min(Math.max(config.votingTimeSeconds, 15), 120),
    };

    // Fetch questions
    this.questions = await fetchTriviaQuestions(this.state.config.totalRounds + 2);

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

    // Get next question
    const question = this.questions.shift();
    if (!question) {
      this.endGame();
      return;
    }

    this.state.currentQuestion = question;
    this.state.phase = "question";
    this.broadcastState();

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

    // Start countdown timer
    this.startTimer(() => {
      this.endAnsweringPhase();
    }, this.state.config.answerTimeSeconds);
  }

  // Handle answer submission
  handleSubmitAnswer(conn: Party.Connection, answer: string) {
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

    // Check if answer is too similar to correct answer
    if (this.state.currentQuestion && 
        isTooSimilarToCorrect(answer, this.state.currentQuestion.correctAnswer)) {
      this.sendError(conn, "Your answer is too similar to the real answer!");
      return;
    }

    player.currentAnswer = answer.trim().substring(0, 100);
    player.hasSubmittedAnswer = true;

    this.broadcastState();

    // Check if all players have submitted
    if (this.state.players.every((p) => p.hasSubmittedAnswer)) {
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

    // Add player answers
    this.state.players.forEach((p) => {
      if (p.currentAnswer) {
        answers.push({
          id: generateId(),
          text: p.currentAnswer,
          playerId: p.id,
          isCorrect: false,
          isAI: false,
          votes: [],
        });
      }
    });

    // Generate AI fake answer
    try {
      const aiAnswer = await generateFakeAnswer(this.state.currentQuestion);
      answers.push({
        id: generateId(),
        text: aiAnswer,
        playerId: null,
        isCorrect: false,
        isAI: true,
        votes: [],
      });
    } catch (error) {
      console.error("Failed to generate AI answer:", error);
      // Add a fallback
      answers.push({
        id: generateId(),
        text: "Unknown",
        playerId: null,
        isCorrect: false,
        isAI: true,
        votes: [],
      });
    }

    // Add correct answer
    answers.push({
      id: generateId(),
      text: this.state.currentQuestion.correctAnswer,
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
    this.broadcastState();

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

    // Check if all players have voted
    if (this.state.players.every((p) => p.hasVoted)) {
      this.stopTimer();
      this.endVotingPhase();
    }
  }

  // End voting and calculate scores
  endVotingPhase() {
    this.stopTimer();

    const roundScores: { playerId: string; pointsEarned: number; reason: string }[] = [];

    // Calculate scores
    this.state.players.forEach((player) => {
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
          reasons.push(`Fooled \${fooledCount} player\${fooledCount > 1 ? "s" : ""}!`);
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
    this.broadcastState();
  }

  // Handle next round request
  async handleNextRound(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player?.isHost) {
      this.sendError(conn, "Only the host can advance rounds");
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

  // Handle player leaving
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
