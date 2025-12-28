'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { usePartySocket } from '@/lib/usePartySocket';
import type { Player, Answer } from '@/lib/game-types';

export default function PlayerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const nameFromUrl = searchParams.get('name');

  const [playerName, setPlayerName] = useState(nameFromUrl || '');
  const [hasJoined, setHasJoined] = useState(false);
  const [answer, setAnswer] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);

  const { isConnected, gameState, join, submitAnswer, submitVote } = usePartySocket({
    roomId,
    onError: setError,
    onTimeUpdate: setTimeRemaining,
  });

  // Get current player
  const currentPlayer = gameState?.players.find(p => p.name === playerName);

  // Auto-join if name in URL
  useEffect(() => {
    if (isConnected && nameFromUrl && !hasJoined) {
      join(nameFromUrl);
      setHasJoined(true);
    }
  }, [isConnected, nameFromUrl, hasJoined, join]);

  // Update time from state
  useEffect(() => {
    if (gameState?.timeRemaining !== undefined) {
      setTimeRemaining(gameState.timeRemaining);
    }
  }, [gameState?.timeRemaining]);

  // Reset states on phase change
  useEffect(() => {
    if (gameState?.phase === 'answering') {
      setAnswer('');
    }
    if (gameState?.phase === 'voting') {
      setSelectedAnswer(null);
    }
  }, [gameState?.phase]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    join(playerName.trim());
    setHasJoined(true);
  };

  const handleSubmitAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) {
      setError('Please enter an answer');
      return;
    }
    submitAnswer(answer.trim());
    setError('');
  };

  const handleVote = (answerId: string) => {
    setSelectedAnswer(answerId);
    submitVote(answerId);
  };

  const getTimerClass = () => {
    if (timeRemaining <= 5) return 'timer danger';
    if (timeRemaining <= 15) return 'timer warning';
    return 'timer';
  };

  if (!isConnected) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-lg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto var(--spacing-lg)' }}></div>
          <p style={{ color: 'var(--color-text-secondary)' }}>Connecting...</p>
        </div>
      </main>
    );
  }

  // Join Screen
  if (!hasJoined || !currentPlayer) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-lg)' }}>
        <div className="card animate-fade-in" style={{ maxWidth: '400px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
            <h1 style={{
              fontSize: '1.5rem',
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 'var(--spacing-sm)'
            }}>
              FIBBAGE AI
            </h1>
            <p style={{ color: 'var(--color-text-muted)' }}>Joining room <strong style={{ color: 'var(--color-primary-light)' }}>{roomId}</strong></p>
          </div>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            <div>
              <label htmlFor="name" className="label">Your Name</label>
              <input
                id="name"
                type="text"
                className="input"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && (
              <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', textAlign: 'center' }}>{error}</p>
            )}

            <button type="submit" className="btn btn-primary btn-large btn-full">
              Join Game
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>PLAYER</div>
          <div style={{ fontWeight: 700, fontSize: '1.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{currentPlayer.name}</div>
        </div>
        {(gameState?.phase === 'answering' || gameState?.phase === 'voting') && (
          <div className={getTimerClass()} style={{ width: '50px', height: '50px', fontSize: '1.2rem', borderWidth: '3px' }}>
            {timeRemaining}
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SCORE</div>
          <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-primary-light)', textShadow: '0 0 10px rgba(168, 85, 247, 0.5)' }}>
            {currentPlayer.score.toLocaleString()}
          </div>
        </div>
      </header>

      {error && (
        <div className="status" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', marginBottom: 'var(--spacing-lg)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '4px' }}>✕</button>
        </div>
      )}

      {/* LOBBY */}
      {gameState?.phase === 'lobby' && (
        <div className="card-glass animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div className="spinner" style={{ marginBottom: 'var(--spacing-lg)' }}></div>
          <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '2rem' }}>YOU ARE IN.</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            {gameState.players.length} player{gameState.players.length !== 1 ? 's' : ''} in lobby
          </p>
          <div style={{ marginTop: 'var(--spacing-xl)', color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
            Look at the big screen for the game code and instructions.
          </div>
          <ul className="player-list" style={{ justifyContent: 'center', marginTop: 'var(--spacing-lg)' }}>
            {gameState.players.map((player) => (
              <li key={player.id} className={`player-chip ${player.id === currentPlayer.id ? 'host' : ''}`}>
                <span className="player-avatar">{player.name.charAt(0).toUpperCase()}</span>
                {player.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* QUESTION DISPLAY */}
      {gameState?.phase === 'question' && gameState.currentQuestion && (
        <div className="card-glass animate-slide-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <span className="question-category">{gameState.currentQuestion.category}</span>
          <h2 style={{ fontSize: 'clamp(1.2rem, 5vw, 1.8rem)', marginTop: 'var(--spacing-lg)', lineHeight: 1.4 }}>
            {gameState.currentQuestion.text}
          </h2>
          <div style={{ marginTop: 'var(--spacing-2xl)', padding: 'var(--spacing-lg)', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-lg)' }}>
            <p style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              THINK FAST!
            </p>
            <p style={{ color: 'var(--color-text-muted)' }}>
              Prepare your deception...
            </p>
          </div>
        </div>
      )}

      {/* ANSWERING PHASE */}
      {gameState?.phase === 'answering' && gameState.currentQuestion && (
        <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="card-glass" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-lg)' }}>
            <span className="question-category" style={{ marginBottom: 'var(--spacing-sm)', display: 'inline-block', fontSize: '0.7rem' }}>
              {gameState.currentQuestion.category}
            </span>
            <p style={{ fontSize: '1rem', lineHeight: 1.5, fontWeight: 500 }}>{gameState.currentQuestion.text}</p>
          </div>

          {currentPlayer.hasSubmittedAnswer ? (
            <div className="card-glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)', filter: 'drop-shadow(0 0 15px var(--color-success))' }}>✓</div>
              <h3 style={{ color: 'var(--color-success)', fontSize: '2rem' }}>LIE LOCKED.</h3>
              <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--spacing-md)' }}>
                Waiting for the slowpokes...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitAnswer} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              <div style={{ flex: 1 }}>
                <label className="label" style={{ fontSize: '1rem', color: 'var(--color-primary-light)' }}>CRAFT YOUR LIE</label>
                <textarea
                  className="input"
                  placeholder="Make it sound true..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  maxLength={100}
                  style={{
                    height: '150px',
                    resize: 'none',
                    fontSize: '1.25rem',
                    padding: '1rem',
                    background: 'rgba(0,0,0,0.4)',
                    border: '2px solid rgba(168, 85, 247, 0.3)'
                  }}
                  autoFocus
                />
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-xs)' }}>
                  {answer.length}/100
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-large btn-full animate-glow" disabled={!answer.trim()} style={{ fontSize: '1.2rem', padding: '1.2rem' }}>
                SUBMIT LIE
              </button>
            </form>
          )}
        </div>
      )}

      {/* VOTING PHASE */}
      {gameState?.phase === 'voting' && gameState.currentQuestion && (
        <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-sm)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Find The Truth</h2>
          </div>

          {currentPlayer.hasVoted ? (
            <div className="card-glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)', filter: 'drop-shadow(0 0 15px var(--color-primary))' }}>🗳️</div>
              <h3 style={{ color: 'var(--color-primary-light)', fontSize: '2rem' }}>VOTE CAST.</h3>
              <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--spacing-md)' }}>
                Fingers crossed...
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', paddingBottom: '2rem' }}>
              {gameState.answers
                .filter(a => a.playerId !== currentPlayer.id) // Can't vote for own answer
                .map((answer, index) => (
                  <button
                    key={answer.id}
                    onClick={() => handleVote(answer.id)}
                    className={`answer-card ${selectedAnswer === answer.id ? 'selected' : ''}`}
                    style={{
                      textAlign: 'left',
                      padding: 'var(--spacing-lg)',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{
                      fontSize: '1rem',
                      color: 'var(--color-text-muted)',
                      marginRight: '1rem',
                      fontWeight: 800,
                      opacity: 0.7
                    }}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.3 }}>{answer.text}</div>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* RESULTS */}
      {gameState?.phase === 'results' && (
        <div className="card-glass animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Round Recap</h2>

          {/* Find the last round result */}
          {(() => {
            const lastResult = gameState.roundResults[gameState.roundResults.length - 1];
            const myScore = lastResult?.scores.find(s => s.playerId === currentPlayer.id);

            return (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '5rem', marginBottom: 'var(--spacing-md)', filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}>
                  {myScore && myScore.pointsEarned > 0 ? '🎉' : '💀'}
                </div>
                <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-primary-light)', marginBottom: 'var(--spacing-sm)', textShadow: '0 0 15px rgba(168, 85, 247, 0.4)' }}>
                  +{myScore?.pointsEarned || 0}
                </div>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem', maxWidth: '300px', margin: '0 auto' }}>
                  {myScore?.reason || 'Better luck next round!'}
                </p>

                <div style={{ marginTop: 'var(--spacing-2xl)', padding: 'var(--spacing-lg)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-xs)', textTransform: 'uppercase' }}>Total Score</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>
                    {currentPlayer.score.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })()}

          <p style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)', color: 'var(--color-text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
            Look at the big screen...
          </p>
        </div>
      )}

      {/* GAME OVER */}
      {gameState?.phase === 'game-over' && (
        <div className="card-glass animate-slide-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h1 style={{
            fontSize: '2.5rem',
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 'var(--spacing-lg)',
            filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.3))'
          }}>
            GAME OVER
          </h1>

          {(() => {
            const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
            const myRank = sortedPlayers.findIndex(p => p.id === currentPlayer.id) + 1;
            const isWinner = myRank === 1;

            return (
              <>
                <div style={{ fontSize: '5rem', marginBottom: 'var(--spacing-md)', filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}>
                  {isWinner ? '🏆' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '👏'}
                </div>
                <h2 style={{ marginBottom: 'var(--spacing-lg)', fontSize: '1.5rem' }}>
                  {isWinner ? 'VICTORY!' : `You finished #${myRank}`}
                </h2>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary-light)' }}>
                  {currentPlayer.score.toLocaleString()} <span style={{ fontSize: '1rem', opacity: 0.7 }}>PTS</span>
                </div>
              </>
            );
          })()}

          <p style={{ marginTop: 'var(--spacing-2xl)', color: 'var(--color-text-muted)' }}>
            Waiting for host...
          </p>
        </div>
      )}
    </main>
  );
}
