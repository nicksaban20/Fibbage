'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [mode, setMode] = useState<'menu' | 'host' | 'join'>('menu');
  const [error, setError] = useState('');

  const handleCreateGame = () => {
    // Generate a random room code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    router.push(`/host/${code}`);
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    const code = joinCode.toUpperCase().trim();
    router.push(`/play/${code}?name=${encodeURIComponent(playerName.trim())}`);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-lg)' }}>
      {/* Logo & Title */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-2xl)' }} className="animate-fade-in">
        <h1 style={{
          marginBottom: 'var(--spacing-sm)',
          background: 'var(--gradient-primary)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontSize: 'clamp(3rem, 8vw, 5rem)',
          letterSpacing: '-0.03em',
          filter: 'drop-shadow(0 0 20px rgba(139, 92, 246, 0.3))'
        }}>
          FIBBAGE AI
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto', lineHeight: '1.4' }}>
          The Bluffing Trivia Game Where <span style={{ color: 'var(--color-accent-light)' }}>AI</span> Tries to Trick You
        </p>
      </div>

      {mode === 'menu' && (
        <div className="card-glass animate-slide-up" style={{ padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-xl)', maxWidth: '400px', width: '100%', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            <button
              onClick={handleCreateGame}
              className="btn btn-primary btn-large btn-full"
              style={{ fontSize: '1.25rem', padding: 'var(--spacing-lg)' }}
            >
              <span style={{ fontSize: '1.5rem', marginRight: 'var(--spacing-sm)' }}>🎮</span>
              Host a Game
            </button>

            <button
              onClick={() => setMode('join')}
              className="btn btn-secondary btn-large btn-full"
              style={{ fontSize: '1.25rem', padding: 'var(--spacing-lg)' }}
            >
              <span style={{ fontSize: '1.5rem', marginRight: 'var(--spacing-sm)' }}>👋</span>
              Join a Game
            </button>
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div className="card-glass animate-slide-up" style={{ padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-xl)', maxWidth: '400px', width: '100%', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <button
            onClick={() => { setMode('menu'); setError(''); }}
            className="btn btn-ghost"
            style={{ marginBottom: 'var(--spacing-lg)', paddingLeft: 0 }}
          >
            ← Back to Menu
          </button>

          <h2 style={{ marginBottom: 'var(--spacing-xl)', textAlign: 'center' }}>Join Room</h2>

          <form onSubmit={handleJoinGame} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            <div>
              <label htmlFor="playerName" className="label" style={{ marginLeft: 'var(--spacing-xs)' }}>Your Name</label>
              <input
                id="playerName"
                type="text"
                className="input"
                placeholder="e.g. Slick Nick"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                autoComplete="off"
                style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              />
            </div>

            <div>
              <label htmlFor="roomCode" className="label" style={{ marginLeft: 'var(--spacing-xs)' }}>Room Code</label>
              <input
                id="roomCode"
                type="text"
                className="input input-large"
                placeholder="ABCD"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={4}
                autoComplete="off"
                style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
              />
            </div>

            {error && (
              <div className="status-danger animate-fade-in" style={{
                color: 'var(--color-error)',
                fontSize: '0.875rem',
                textAlign: 'center',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: 'var(--spacing-sm)',
                borderRadius: 'var(--radius-md)'
              }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-large btn-full">
              Enter Room
            </button>
          </form>
        </div>
      )}

      {/* How to Play */}
      <div className="animate-fade-in" style={{ marginTop: 'var(--spacing-2xl)', width: '100%', maxWidth: '900px' }}>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem', marginBottom: 'var(--spacing-lg)' }}>
          How to Play
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-lg)' }}>
          <div className="card-glass" style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: 'var(--spacing-lg)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-sm)' }}>❓</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-xs)' }}>Get a Question</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>You'll get an obscure trivia fact with a missing word.</p>
          </div>
          <div className="card-glass" style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: 'var(--spacing-lg)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-sm)' }}>✍️</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-xs)' }}>Lie Convincingly</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Write a fake answer to fool your friends.</p>
          </div>
          <div className="card-glass" style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: 'var(--spacing-lg)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-sm)' }}>🔍</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-xs)' }}>Spot the Truth</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Find the real answer among the lies (and AI fakes!).</p>
          </div>
          <div className="card-glass" style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: 'var(--spacing-lg)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-sm)' }}>🏆</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-xs)' }}>Win Points</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Score for guessing right and for fooling others.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
