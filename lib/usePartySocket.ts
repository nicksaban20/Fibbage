'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import PartySocket from 'partysocket';
import type { GameState, ClientMessage, ServerMessage } from './game-types';

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || 'localhost:1999';

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

  useEffect(() => {
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
    });

    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setIsConnected(true);
    });

    socket.addEventListener('close', () => {
      setIsConnected(false);
    });

    socket.addEventListener('message', (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'state-update':
            setGameState(message.state);
            onStateUpdate?.(message.state);
            break;
          case 'error':
            onError?.(message.message);
            break;
          case 'time-update':
            onTimeUpdate?.(message.timeRemaining);
            if (gameState) {
              setGameState({ ...gameState, timeRemaining: message.timeRemaining });
            }
            break;
          case 'player-joined':
          case 'player-left':
          case 'phase-change':
            // These are handled via state-update
            break;
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId]);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  const join = useCallback((name: string, isHost?: boolean) => {
    sendMessage({ type: 'join', name, isHost });
  }, [sendMessage]);

  const startGame = useCallback((config: { totalRounds: number; answerTimeSeconds: number; votingTimeSeconds: number; aiAnswerCount: number }) => {
    sendMessage({ type: 'start-game', config });
  }, [sendMessage]);

  const submitAnswer = useCallback((answer: string) => {
    sendMessage({ type: 'submit-answer', answer });
  }, [sendMessage]);

  const submitVote = useCallback((answerId: string) => {
    sendMessage({ type: 'submit-vote', answerId });
  }, [sendMessage]);

  const nextRound = useCallback(() => {
    sendMessage({ type: 'next-round' });
  }, [sendMessage]);

  const playAgain = useCallback(() => {
    sendMessage({ type: 'play-again' });
  }, [sendMessage]);

  const leave = useCallback(() => {
    sendMessage({ type: 'leave' });
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
  };
}
