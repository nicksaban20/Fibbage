'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePartySocket } from '@/lib/usePartySocket';
import type { GameConfig, Player, Answer } from '@/lib/game-types';
import { DEFAULT_CONFIG } from '@/lib/game-types';

export default function HostPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  
  const [config, setConfig] = useState<GameConfig>({ ...DEFAULT_CONFIG });
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);

  const { isConnected, gameState, join, startGame, nextRound, playAgain } = usePartySocket({
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
    startGame(config);
  };

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
        <h1 style={{ fontSize: '1.5rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          FIBBAGE AI
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
          {gameState.phase !== 'lobby' && gameState.phase !== 'game-over' && (
            <div className={getTimerClass()}>{timeRemaining}</div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Room Code</div>
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
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ marginBottom: 'var(--spacing-xl)' }}>Waiting for Players</h2>
            
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-md)' }}>
                Players join at <strong style={{ color: 'var(--color-primary-light)' }}>this website</strong> with code:
              </p>
              <div className="room-code animate-glow">{gameState.roomCode}</div>
            </div>

            {/* Player list */}
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                {gameState.players.length} player{gameState.players.length !== 1 ? 's' : ''} joined
              </p>
              <ul className="player-list" style={{ justifyContent: 'center' }}>
                {gameState.players.map((player) => (
                  <li key={player.id} className={`player-chip \${player.isHost ? 'host' : ''}`}>
                    <span className="player-avatar">{player.name.charAt(0).toUpperCase()}</span>
                    {player.name}
                    {player.isHost && <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>👑</span>}
                  </li>
                ))}
              </ul>
            </div>

            {/* Game config */}
            <div style={{ 
              background: 'var(--color-bg-elevated)', 
              padding: 'var(--spacing-lg)', 
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-xl)'
            }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-secondary)' }}>Game Settings</h3>
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
                      <option key={n} value={n}>{n} rounds</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Answer Time</label>
                  <select 
                    className="input"
                    value={config.answerTimeSeconds}
                    onChange={(e) => setConfig({ ...config, answerTimeSeconds: parseInt(e.target.value) })}
                    style={{ cursor: 'pointer' }}
                  >
                    {[30, 45, 60, 90, 120].map(n => (
                      <option key={n} value={n}>{n} seconds</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Voting Time</label>
                  <select 
                    className="input"
                    value={config.votingTimeSeconds}
                    onChange={(e) => setConfig({ ...config, votingTimeSeconds: parseInt(e.target.value) })}
                    style={{ cursor: 'pointer' }}
                  >
                    {[30, 45, 60, 90].map(n => (
                      <option key={n} value={n}>{n} seconds</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button 
              onClick={handleStartGame}
              className="btn btn-primary btn-large"
              disabled={gameState.players.length < 2}
            >
              {gameState.players.length < 2 ? 'Need 2+ players to start' : 'Start Game'}
            </button>
          </div>
        </div>
      )}

      {/* QUESTION PHASE */}
      {gameState.phase === 'question' && gameState.currentQuestion && (
        <div className="animate-slide-up">
          <div className="card question-display" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-muted)' }}>
              Round {gameState.currentRound} of {gameState.config.totalRounds}
            </div>
            <span className="question-category">{gameState.currentQuestion.category}</span>
            <h2 className="question-text">{gameState.currentQuestion.text}</h2>
            <p style={{ marginTop: 'var(--spacing-xl)', color: 'var(--color-text-muted)' }}>
              Get ready to write your fake answer...
            </p>
          </div>
        </div>
      )}

      {/* ANSWERING PHASE */}
      {gameState.phase === 'answering' && gameState.currentQuestion && (
        <div className="animate-fade-in">
          <div className="card question-display" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-muted)' }}>
              Round {gameState.currentRound} of {gameState.config.totalRounds}
            </div>
            <span className="question-category">{gameState.currentQuestion.category}</span>
            <h2 className="question-text" style={{ marginBottom: 'var(--spacing-xl)' }}>{gameState.currentQuestion.text}</h2>
            
            <div className="status status-waiting" style={{ maxWidth: '400px', margin: '0 auto' }}>
              <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
              <span>
                Waiting for answers... ({gameState.players.filter(p => p.hasSubmittedAnswer).length}/{gameState.players.length})
              </span>
            </div>

            <ul className="player-list" style={{ justifyContent: 'center', marginTop: 'var(--spacing-lg)' }}>
              {gameState.players.map((player) => (
                <li 
                  key={player.id} 
                  className="player-chip"
                  style={{ 
                    background: player.hasSubmittedAnswer ? 'var(--color-success)' : 'var(--color-bg-elevated)',
                    opacity: player.hasSubmittedAnswer ? 1 : 0.5
                  }}
                >
                  <span className="player-avatar">{player.name.charAt(0).toUpperCase()}</span>
                  {player.name}
                  {player.hasSubmittedAnswer && <span>✓</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* VOTING PHASE */}
      {gameState.phase === 'voting' && gameState.currentQuestion && (
        <div className="animate-fade-in">
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
            <div style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-sm)' }}>
              Round {gameState.currentRound} of {gameState.config.totalRounds}
            </div>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Which answer is TRUE?</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>{gameState.currentQuestion.text}</p>
          </div>

          <div className="answer-grid" style={{ maxWidth: '1000px', margin: '0 auto var(--spacing-xl)' }}>
            {gameState.answers.map((answer, index) => (
              <div key={answer.id} className="answer-card">
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                  Answer {String.fromCharCode(65 + index)}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{answer.text}</div>
              </div>
            ))}
          </div>

          <div className="status status-waiting" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div>
            <span>
              Waiting for votes... ({gameState.players.filter(p => p.hasVoted).length}/{gameState.players.length})
            </span>
          </div>
        </div>
      )}

      {/* RESULTS PHASE */}
      {gameState.phase === 'results' && gameState.currentQuestion && (
        <div className="animate-slide-up">
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Round {gameState.currentRound} Results</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>{gameState.currentQuestion.text}</p>
          </div>

          <div className="answer-grid" style={{ maxWidth: '1000px', margin: '0 auto var(--spacing-xl)' }}>
            {gameState.answers.map((answer, index) => {
              const authorPlayer = gameState.players.find(p => p.id === answer.playerId);
              return (
                <div 
                  key={answer.id} 
                  className={`answer-card \${answer.isCorrect ? 'correct' : ''} \${answer.isAI ? 'ai' : ''}`}
                  style={{ cursor: 'default' }}
                >
                  {answer.votes.length > 0 && (
                    <div className="votes">
                      {answer.votes.map((voterId) => {
                        const voter = gameState.players.find(p => p.id === voterId);
                        return (
                          <span key={voterId} className="player-avatar" style={{ width: '24px', height: '24px', fontSize: '0.75rem' }}>
                            {voter?.name.charAt(0).toUpperCase()}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-sm)' }}>
                    {answer.isCorrect ? '✓ THE TRUTH' : answer.isAI ? '🤖 AI LIE' : `Written by \${authorPlayer?.name || 'Unknown'}`}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{answer.text}</div>
                  {answer.votes.length > 0 && !answer.isCorrect && !answer.isAI && (
                    <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.875rem', color: 'var(--color-success)' }}>
                      +{answer.votes.length * 500} points for fooling {answer.votes.length} player{answer.votes.length > 1 ? 's' : ''}!
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Current Scores */}
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto var(--spacing-xl)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>Scores</h3>
            <div className="scoreboard">
              {[...gameState.players]
                .sort((a, b) => b.score - a.score)
                .map((player, idx) => (
                  <div key={player.id} className={`score-row \${idx === 0 ? 'winner' : ''}`}>
                    <span className="score-rank">{idx + 1}</span>
                    <span className="score-name">{player.name}</span>
                    <span className="score-points">{player.score.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={nextRound} className="btn btn-primary btn-large">
              {gameState.currentRound >= gameState.config.totalRounds ? 'See Final Results' : 'Next Round'}
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER PHASE */}
      {gameState.phase === 'game-over' && (
        <div className="animate-slide-up">
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
            <h1 style={{ 
              fontSize: '3rem', 
              background: 'var(--gradient-primary)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              marginBottom: 'var(--spacing-md)'
            }}>
              Game Over!
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.25rem' }}>
              {[...gameState.players].sort((a, b) => b.score - a.score)[0]?.name} wins!
            </p>
          </div>

          <div className="card" style={{ maxWidth: '600px', margin: '0 auto var(--spacing-xl)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-lg)', textAlign: 'center' }}>Final Scores</h3>
            <div className="scoreboard">
              {[...gameState.players]
                .sort((a, b) => b.score - a.score)
                .map((player, idx) => (
                  <div key={player.id} className={`score-row \${idx === 0 ? 'winner' : ''}`}>
                    <span className="score-rank">
                      {idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </span>
                    <span className="score-name">{player.name}</span>
                    <span className="score-points">{player.score.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={playAgain} className="btn btn-primary btn-large">
              Play Again
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
