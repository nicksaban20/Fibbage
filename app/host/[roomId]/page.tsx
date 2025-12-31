'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePartySocket } from '@/lib/usePartySocket';
import type { GameConfig } from '@/lib/game-types';
import { DEFAULT_CONFIG, SCORING } from '@/lib/game-types';

export default function HostPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [config, setConfig] = useState<GameConfig>({ ...DEFAULT_CONFIG });
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const { isConnected, gameState, join, startGame, nextRound, playAgain, kickPlayer, skipTimer } = usePartySocket({
    roomId,
    onError: setError,
    onTimeUpdate: setTimeRemaining,
  });

  // Auto-join as host
  useEffect(() => {
    if (isConnected && !gameState?.players.some(p => p.isHost)) {
      join('Host', true);
    }
  }, [isConnected, gameState, join]);

  // Update time from state
  useEffect(() => {
    if (gameState?.timeRemaining !== undefined) {
      setTimeRemaining(gameState.timeRemaining);
    }
  }, [gameState?.timeRemaining]);

  const handleStartGame = () => {
    if (isProcessing) return; // Prevent double-clicks
    setIsProcessing(true);
    setError('');
    startGame(config);
  };

  const handleNextRound = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    nextRound();
  };

  const handlePlayAgain = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    playAgain();
  };

  // Reset processing state when phase changes
  useEffect(() => {
    setIsProcessing(false);
  }, [gameState?.phase]);

  const getTimerClass = () => {
    if (timeRemaining <= 5) return 'timer danger';
    if (timeRemaining <= 15) return 'timer warning';
    return 'timer';
  };

  if (!isConnected) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto var(--spacing-lg)' }}></div>
          <p style={{ color: 'var(--color-text-secondary)' }}>Connecting to game server...</p>
        </div>
      </main>
    );
  }

  if (!gameState) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--spacing-xl)' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
        <h1 style={{ fontSize: '1.5rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.3))' }}>
          FIBBAGE AI
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          {gameState.phase !== 'lobby' && gameState.phase !== 'game-over' && gameState.phase !== 'question' && (
            <div className={getTimerClass()}>{timeRemaining}</div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Join Code</div>
            <div className="room-code" style={{ fontSize: '1.5rem', padding: 'var(--spacing-sm) var(--spacing-md)' }}>
              {gameState.roomCode}
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="status" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', marginBottom: 'var(--spacing-lg)' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* LOBBY PHASE */}
      {gameState.phase === 'lobby' && (
        <div className="animate-fade-in">
          <div className="card-glass" style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
            <h2 style={{ marginBottom: 'var(--spacing-xl)', fontSize: '2.5rem', background: 'linear-gradient(to right, #fff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              THE ARENA AWAITS
            </h2>

            <div style={{ marginBottom: 'var(--spacing-xl)', background: 'rgba(0,0,0,0.2)', padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)', fontSize: '1.1rem' }}>
                Join at <strong style={{ color: 'white' }}>fibbage-green.vercel.app</strong> with code:
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <div className="room-code animate-glow" style={{ fontSize: '4rem', padding: 'var(--spacing-md) var(--spacing-2xl)' }}>
                  {gameState.roomCode}
                </div>
                <button
                  onClick={() => setShowQr(true)}
                  className="btn btn-secondary"
                  style={{ borderRadius: '50%', width: '50px', height: '50px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Show QR Code"
                >
                  <span style={{ fontSize: '1.5rem' }}>📱</span>
                </button>
              </div>
            </div>

            {/* QR Code Overlay */}
            {showQr && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(0,0,0,0.9)',
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <div style={{ position: 'relative', width: '90vh', height: '90vh' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/adobe-express-qr-code.png"
                    alt="Scan to Join"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  <button
                    onClick={() => setShowQr(false)}
                    style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      background: 'white',
                      color: 'black',
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      border: 'none',
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}
                  >
                    ✕
                  </button>
                </div>
                <p style={{ marginTop: 'var(--spacing-md)', fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>
                  Scan to Join
                </p>
              </div>
            )}

            {/* Player list */}
            <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: 'var(--spacing-lg)' }}>
                <span style={{ height: '1px', width: '50px', background: 'rgba(255,255,255,0.1)' }}></span>
                <p style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem' }}>
                  {gameState.players.filter(p => !p.isHost).length} Contenders Ready
                </p>
                <span style={{ height: '1px', width: '50px', background: 'rgba(255,255,255,0.1)' }}></span>
              </div>

              <ul className="player-list" style={{ justifyContent: 'center', minHeight: '100px' }}>
                {gameState.players.filter(p => !p.isHost).length === 0 ? (
                  <li style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Waiting for brave souls...</li>
                ) : (
                  gameState.players.filter(p => !p.isHost).map((player) => (
                    <li key={player.id} className="player-chip animate-slide-up" style={{ opacity: player.isOnline ? 1 : 0.5, border: player.isOnline ? undefined : '1px dashed rgba(255,255,255,0.3)' }}>
                      <span className="player-avatar" style={{ background: player.isOnline ? undefined : 'gray' }}>{player.name.charAt(0).toUpperCase()}</span>
                      {player.name}
                      {!player.isOnline && <span style={{ fontSize: '0.7em', marginLeft: '0.5em', fontStyle: 'italic' }}>(Offline)</span>}
                      {/* Kick Button (Host Only) */}
                      {gameState.players.find(p => p.isHost && p.isOnline)?.id === gameState.players.find(p => p.isHost && p.isOnline)?.id && (
                        // Logic check: Am I the host? The UI is for the HOST only (HostPage). 
                        // HostPage is ALWAYS the host view (or at least intended).
                        // But wait, `HostPage` joins as "Host".
                        // So yes, this UI is for the host. I can just render the button.
                        <button
                          onClick={() => {
                            if (confirm(`Kick ${player.name}?`)) {
                              kickPlayer(player.id);
                            }
                          }}
                          style={{
                            marginLeft: 'auto',
                            background: 'rgba(255, 0, 0, 0.2)',
                            border: '1px solid rgba(255, 0, 0, 0.5)',
                            color: '#ff4444',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '0.7rem',
                            cursor: 'pointer'
                          }}
                          title="Kick player"
                        >
                          X
                        </button>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Game config */}
            <div style={{
              background: 'rgba(0,0,0,0.2)',
              padding: 'var(--spacing-lg)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--spacing-xl)',
              textAlign: 'left'
            }}>
              <h3 style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-md)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Match Settings</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--spacing-lg)' }}>
                <div>
                  <label className="label">Rounds</label>
                  <select
                    className="input"
                    value={config.totalRounds}
                    onChange={(e) => setConfig({ ...config, totalRounds: parseInt(e.target.value) })}
                    style={{ cursor: 'pointer' }}
                  >
                    {[3, 5, 7, 10, 15].map(n => (
                      <option key={n} value={n}>{n} Rounds</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Lie Timer</label>
                  <select
                    className="input"
                    value={config.answerTimeSeconds}
                    onChange={(e) => setConfig({ ...config, answerTimeSeconds: parseInt(e.target.value) })}
                    style={{ cursor: 'pointer' }}
                  >
                    {[15, 30, 45, 60, 90, 120, 180].map(n => (
                      <option key={n} value={n}>{n}s</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Vote Timer</label>
                  <select
                    className="input"
                    value={config.votingTimeSeconds}
                    onChange={(e) => setConfig({ ...config, votingTimeSeconds: parseInt(e.target.value) })}
                    style={{ cursor: 'pointer' }}
                  >
                    {[15, 30, 45, 60, 90, 120].map(n => (
                      <option key={n} value={n}>{n}s</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">AI Answers</label>
                  <select
                    className="input"
                    value={config.aiAnswerCount}
                    onChange={(e) => setConfig({ ...config, aiAnswerCount: parseInt(e.target.value) })}
                    style={{ cursor: 'pointer' }}
                  >
                    {[0, 1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n === 0 ? 'None' : n === 1 ? '1 AI Answer' : `${n} AI Answers`}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
                  <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={config.verifyAnswers}
                      onChange={(e) => setConfig({ ...config, verifyAnswers: e.target.checked })}
                      style={{ marginRight: '10px', width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                      Verify Answers <span style={{ fontSize: '0.8rem', color: 'var(--color-primary-light)', marginLeft: '4px' }}>(Slower)</span>
                    </span>
                  </label>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">AI Model</label>
                  <select
                    className="input"
                    value={config.model || 'claude-haiku-4-5-20251001'}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    style={{ cursor: 'pointer', width: '100%' }}
                  >
                    <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fast & Creative)</option>
                    <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Smart & Logical)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartGame}
              className="btn btn-primary btn-large animate-glow"
              disabled={gameState.players.filter(p => !p.isHost).length < 2 || isProcessing}
              style={{ padding: '1.2rem 3rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
            >
              {isProcessing ? (
                <>
                  <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
                  STARTING...
                </>
              ) : gameState.players.filter(p => !p.isHost).length < 2 ? (
                'WAITING FOR 2+ PLAYERS'
              ) : (
                'START THE GAME'
              )}
            </button>
          </div>
        </div>
      )}

      {/* LOADING PHASE */}
      {gameState.phase === 'loading' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div className="card-glass" style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
            <div className="spinner" style={{ width: '60px', height: '60px', margin: '0 auto var(--spacing-xl)', borderWidth: '4px' }}></div>
            <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '2rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              PREPARING YOUR QUESTION
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>
              Generating a challenging trivia question...
            </p>
          </div>
        </div>
      )}

      {/* QUESTION PHASE */}
      {gameState.phase === 'question' && gameState.currentQuestion && (
        <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div className="card-glass question-display" style={{ maxWidth: '1000px', width: '100%', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%) translateY(-50%)', background: 'var(--gradient-primary)', padding: '0.5rem 1.5rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              ROUND {gameState.currentRound}
            </div>

            <div style={{ marginTop: 'var(--spacing-lg)' }}>
              <span className="question-category">{gameState.currentQuestion.category}</span>
            </div>

            <h2 className="question-text" style={{ fontSize: '3rem', margin: 'var(--spacing-xl) 0' }}>
              {gameState.currentQuestion.text}
            </h2>

            <p style={{ color: 'var(--color-primary-light)', fontSize: '1.25rem', fontWeight: 600 }}>
              GET READY TO LIE...
            </p>
          </div>
        </div>
      )}

      {/* ANSWERING PHASE */}
      {gameState.phase === 'answering' && gameState.currentQuestion && (
        <div className="animate-fade-in">
          <div className="card-glass question-display" style={{ maxWidth: '1000px', margin: '0 auto', marginBottom: 'var(--spacing-xl)' }}>
            <div style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Round {gameState.currentRound}
            </div>
            <span className="question-category">{gameState.currentQuestion.category}</span>
            <h2 className="question-text" style={{ marginBottom: 'var(--spacing-lg)' }}>{gameState.currentQuestion.text}</h2>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div className="status status-waiting" style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
              <span style={{ fontSize: '1.2rem', marginLeft: '10px' }}>
                Waiting for lies... {gameState.players.filter(p => p.hasSubmittedAnswer && !p.isHost).length} / {gameState.players.filter(p => !p.isHost).length}
              </span>
            </div>
            <button
              onClick={skipTimer}
              className="btn-secondary"
              style={{
                marginLeft: '1rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                background: 'rgba(255, 255, 255, 0.1)'
              }}
              title="End timer immediately"
            >
              Skip Timer ⏭
            </button>

            <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', justifyContent: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
              {gameState.players.filter(p => !p.isHost).map((player) => (
                <div
                  key={player.id}
                  className="player-chip"
                  style={{
                    background: player.hasSubmittedAnswer ? 'var(--color-success)' : 'var(--color-bg-elevated)',
                    opacity: player.hasSubmittedAnswer ? 1 : 0.6,
                    transform: player.hasSubmittedAnswer ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: player.hasSubmittedAnswer ? '0 0 20px rgba(16, 185, 129, 0.4)' : 'none',
                    padding: '0.75rem 1.5rem',
                    fontSize: '1.1rem'
                  }}
                >
                  <span className="player-avatar" style={{ width: '30px', height: '30px' }}>{player.name.charAt(0).toUpperCase()}</span>
                  {player.name}
                  {player.hasSubmittedAnswer && <span style={{ marginLeft: '5px' }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VOTING PHASE */}
      {gameState.phase === 'voting' && gameState.currentQuestion && (
        <div className="animate-fade-in">
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ marginBottom: 'var(--spacing-sm)', fontSize: '2.5rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              FIND THE TRUTH
            </h2>
            <p style={{ color: 'var(--color-text-primary)', fontSize: '1.25rem', maxWidth: '800px', margin: '0 auto' }}>{gameState.currentQuestion.text}</p>
          </div>

          <div className="answer-grid" style={{ maxWidth: '1200px', margin: '0 auto var(--spacing-xl)' }}>
            {gameState.answers.map((answer, index) => (
              <div key={answer.id} className="answer-card" style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: 'var(--color-text-muted)',
                  marginRight: 'var(--spacing-md)',
                  opacity: 0.5
                }}>
                  {String.fromCharCode(65 + index)}
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 600 }}>{answer.text}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center' }}>
            <div className="status status-waiting" style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
              <span style={{ fontSize: '1.1rem', marginLeft: '10px' }}>
                Votes cast: {gameState.players.filter(p => p.hasVoted && !p.isHost).length} / {gameState.players.filter(p => !p.isHost).length}
              </span>
            </div>
            <button
              onClick={skipTimer}
              className="btn-secondary"
              style={{
                marginLeft: '1rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                background: 'rgba(255, 255, 255, 0.1)'
              }}
              title="End timer immediately"
            >
              Skip Timer ⏭
            </button>
          </div>
        </div>
      )}

      {/* RESULTS PHASE */}
      {gameState.phase === 'results' && gameState.currentQuestion && (
        <div className="animate-slide-up">
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)', fontSize: '2rem' }}>THE REVEAL</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.25rem' }}>{gameState.currentQuestion.text}</p>
          </div>

          <div className="answer-grid" style={{ maxWidth: '1200px', margin: '0 auto var(--spacing-xl)' }}>
            {gameState.answers.map((answer) => {
              return (
                <div
                  key={answer.id}
                  className={`answer-card ${answer.isCorrect ? 'correct' : ''} ${answer.isAI ? 'ai' : ''}`}
                  style={{
                    cursor: 'default',
                    opacity: answer.isCorrect ? 1 : 0.8,
                    transform: answer.isCorrect ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: answer.isCorrect ? '0 0 30px rgba(34, 197, 94, 0.6)' : 'none',
                    border: answer.isCorrect ? '2px solid #22c55e' : '1px solid transparent',
                    background: answer.isCorrect ? 'rgba(34, 197, 94, 0.2)' : undefined
                  }}
                >
                  {answer.votes.length > 0 && (
                    <div className="votes">
                      {answer.votes.map((voterId) => {
                        const voter = gameState.players.find(p => p.id === voterId);
                        return (
                          <span key={voterId} className="player-avatar animate-fade-in" style={{ width: '28px', height: '28px', fontSize: '0.8rem', border: '2px solid var(--color-bg-card)' }}>
                            {voter?.name.charAt(0).toUpperCase()}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    {answer.isCorrect ? (
                      <span style={{ color: 'var(--color-success)' }}>★ The Truth</span>
                    ) : answer.isAI ? (
                      <span style={{ color: 'var(--color-accent)' }}>🤖 AI Deception</span>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {answer.playerIds?.map(pid => {
                          const p = gameState.players.find(pl => pl.id === pid);
                          return p ? (
                            <span key={pid} className="player-chip small" style={{ fontSize: '0.8rem', padding: '2px 8px' }}>
                              {p.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{answer.text}</div>
                  {answer.votes.length > 0 && !answer.isCorrect && !answer.isAI && (
                    <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.9rem', color: 'var(--color-success)', fontWeight: 600 }}>
                      +{answer.votes.length * SCORING.FOOL_PLAYER} pts (Fooled {answer.votes.length})
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Current Scores */}
          <div className="card-glass" style={{ maxWidth: '700px', margin: '0 auto var(--spacing-xl)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--color-text-muted)' }}>Leaderboard</h3>
            <div className="scoreboard">
              {[...gameState.players]
                .filter(p => !p.isHost)
                .sort((a, b) => b.score - a.score)
                .map((player, idx) => (
                  <div key={player.id} className={`score-row ${idx === 0 ? 'winner' : ''}`} style={{ transition: 'all 0.3s ease' }}>
                    <span className="score-rank" style={{ opacity: idx === 0 ? 1 : 0.5 }}>
                      {idx === 0 ? '👑' : idx + 1}
                    </span>
                    <span className="score-name" style={{ fontSize: '1.1rem' }}>{player.name}</span>
                    <span className="score-points">{player.score.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={handleNextRound} disabled={isProcessing} className="btn btn-primary btn-large animate-glow" style={{ minWidth: '200px' }}>
              {isProcessing ? 'LOADING...' : (gameState.currentRound >= gameState.config.totalRounds ? 'FINISH GAME' : 'NEXT ROUND →')}
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER PHASE */}
      {gameState.phase === 'game-over' && (
        <div className="animate-slide-up">
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
            <h1 style={{
              fontSize: '4rem',
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 'var(--spacing-md)',
              filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.4))'
            }}>
              CHAMPION CROWNED
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.5rem', fontWeight: 300 }}>
              <strong style={{ color: 'white', fontWeight: 700 }}>
                {[...gameState.players].filter(p => !p.isHost).sort((a, b) => b.score - a.score)[0]?.name}
              </strong> proved to be the master of deception.
            </p>
          </div>

          <div className="card-glass" style={{ maxWidth: '600px', margin: '0 auto var(--spacing-xl)', padding: 'var(--spacing-2xl)' }}>
            <div className="scoreboard">
              {[...gameState.players]
                .filter(p => !p.isHost)
                .sort((a, b) => b.score - a.score)
                .map((player, idx) => (
                  <div key={player.id} className={`score-row ${idx === 0 ? 'winner' : ''}`} style={{ transform: idx === 0 ? 'scale(1.05)' : 'none', border: idx === 0 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}>
                    <span className="score-rank" style={{ fontSize: '2rem' }}>
                      {idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </span>
                    <span className="score-name" style={{ fontSize: idx === 0 ? '1.5rem' : '1rem' }}>{player.name}</span>
                    <span className="score-points" style={{ fontSize: idx === 0 ? '1.5rem' : '1.25rem' }}>{player.score.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={handlePlayAgain} disabled={isProcessing} className="btn btn-secondary btn-large">
              {isProcessing ? 'Resetting...' : 'Play Again'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
