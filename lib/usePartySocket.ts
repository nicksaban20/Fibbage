'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import PartySocket from 'partysocket';
import type { GameState, ClientMessage, ServerMessage, GameConfig } from './game-types';


const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

// Client-side logging helper
const log = (message: string, data?: unknown) => {
  const timestamp = new Date().toLocaleTimeString();
  if (data !== undefined) {
    console.log(`%c[Fibbage ${timestamp}] ${message}`, 'color: #a855f7; font-weight: bold', data);
  } else {
    console.log(`%c[Fibbage ${timestamp}] ${message}`, 'color: #a855f7; font-weight: bold');
  }
};

interface UsePartySocketOptions {
  roomId: string;
  onStateUpdate?: (state: GameState) => void;
  onError?: (message: string) => void;
  onTimeUpdate?: (time: number) => void;
}

export function usePartySocket({ roomId, onStateUpdate, onError, onTimeUpdate }: UsePartySocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const socketRef = useRef<PartySocket | null>(null);
  const prevPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    log(`Connecting to room: ${roomId} at ${PARTYKIT_HOST}`);

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
    });

    socketRef.current = socket;

    socket.addEventListener('open', () => {
      log('✅ WebSocket connected');
      setIsConnected(true);
    });

    socket.addEventListener('close', () => {
      log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    socket.addEventListener('message', (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'state-update':
            // Log phase changes
            if (prevPhaseRef.current !== message.state.phase) {
              log(`📍 Phase changed: ${prevPhaseRef.current || 'null'} → ${message.state.phase}`);
              prevPhaseRef.current = message.state.phase;
            }
            log('📦 State update', {
              phase: message.state.phase,
              round: message.state.currentRound,
              players: message.state.players.length,
              answers: message.state.answers.length,
              question: message.state.currentQuestion?.text?.slice(0, 50) + '...'
            });
            setGameState(message.state);
            onStateUpdate?.(message.state);
            break;
          case 'error':
            log('⚠️ Error from server:', message.message);
            onError?.(message.message);
            break;
          case 'time-update':
            // Only log every 10 seconds to avoid spam
            if (message.timeRemaining % 10 === 0 || message.timeRemaining <= 5) {
              log(`⏱️ Time: ${message.timeRemaining}s`);
            }
            onTimeUpdate?.(message.timeRemaining);
            if (gameState) {
              setGameState({ ...gameState, timeRemaining: message.timeRemaining });
            }
            break;
          case 'player-joined':
            log('👋 Player joined:', message.player.name);
            break;
          case 'player-left':
            log('👋 Player left:', message.playerId);
            break;
          case 'phase-change':
            log('📍 Phase change message:', message.phase);
            break;
          case 'debug-log':
            log(`🔧 Server Log: ${message.message}`, message.data);
            break;
        }
      } catch (error) {
        console.error('[Fibbage] Failed to parse message:', error);
      }
    });

    return () => {
      log('Closing WebSocket connection');
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      log(`📤 Sending: ${message.type}`, message);
      socketRef.current.send(JSON.stringify(message));
    } else {
      log('⚠️ Cannot send - WebSocket not open');
    }
  }, []);

  const join = useCallback((name: string, isHost?: boolean) => {
    log(`Joining as ${isHost ? 'HOST' : 'player'}: ${name}`);
    sendMessage({ type: 'join', name, isHost });
  }, [sendMessage]);

  const startGame = useCallback((config: GameConfig) => {
    log('🎮 Starting game with config:', config);
    sendMessage({ type: 'start-game', config });
  }, [sendMessage]);

  const submitAnswer = useCallback((answer: string) => {
    log(`📝 Submitting answer: "${answer}"`);
    sendMessage({ type: 'submit-answer', answer });
  }, [sendMessage]);

  const submitVote = useCallback((answerId: string) => {
    log(`🗳️ Submitting vote for: ${answerId}`);
    sendMessage({ type: 'submit-vote', answerId });
  }, [sendMessage]);

  const nextRound = useCallback(() => {
    log('⏭️ Requesting next round');
    sendMessage({ type: 'next-round' });
  }, [sendMessage]);

  const playAgain = useCallback(() => {
    log('🔄 Play again requested');
    sendMessage({ type: 'play-again' });
  }, [sendMessage]);

  const leave = useCallback(() => {
    log('🚪 Leaving game');
    sendMessage({ type: 'leave' });
  }, [sendMessage]);

  const kickPlayer = useCallback((playerId: string) => {
    log(`👢 Kicking player: ${playerId}`);
    sendMessage({ type: 'kick-player', playerId });
  }, [sendMessage]);

  const skipTimer = useCallback(() => {
    log('⏩ Skipping timer');
    sendMessage({ type: 'skip-timer' });
  }, [sendMessage]);

  // Quiplash-specific functions
  const submitQuiplashAnswers = useCallback((answers: { promptId: string; answer: string }[]) => {
    log('📝 Submitting Quiplash answers:', answers);
    sendMessage({ type: 'submit-quiplash-answers', answers });
  }, [sendMessage]);

  const submitQuiplashVote = useCallback((matchupId: string, votedPlayerId: string) => {
    log(`🗳️ Voting for ${votedPlayerId} in matchup ${matchupId}`);
    sendMessage({ type: 'submit-quiplash-vote', matchupId, votedPlayerId });
  }, [sendMessage]);

  const nextMatchup = useCallback(() => {
    log('⏭️ Requesting next matchup');
    sendMessage({ type: 'next-matchup' });
  }, [sendMessage]);

  return {
    isConnected,
    gameState,
    join,
    startGame,
    submitAnswer,
    submitVote,
    nextRound,
    playAgain,
    leave,
    kickPlayer,
    skipTimer,
    // Quiplash
    submitQuiplashAnswers,
    submitQuiplashVote,
    nextMatchup,
  };
}

