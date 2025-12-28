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
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Logo & Title */}
      <div className="text-center mb-12 animate-fade-in">
        <h1 className="mb-4" style={{
          background: 'var(--gradient-primary)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: 'none'
        }}>
          FIBBAGE AI
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.25rem' }}>
          The Bluffing Trivia Game Where AI Tries to Trick You
        </p>
      </div>

      {mode === 'menu' && (
        <div className="card animate-slide-up" style={{ maxWidth: '400px', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <button
              onClick={handleCreateGame}
              className="btn btn-primary btn-large btn-full"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Host a Game
            </button>

            <button
              onClick={() => setMode('join')}
              className="btn btn-secondary btn-large btn-full"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Join a Game
            </button>
          </div>

          <div style={{
            marginTop: 'var(--spacing-xl)',
            paddingTop: 'var(--spacing-lg)',
            borderTop: '1px solid rgba(139, 92, 246, 0.2)',
            textAlign: 'center'
          }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              2-8 Players • Answer trivia • Fool your friends
            </p>
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div className="card animate-slide-up" style={{ maxWidth: '400px', width: '100%' }}>
          <button
            onClick={() => { setMode('menu'); setError(''); }}
            className="btn btn-ghost"
            style={{ marginBottom: 'var(--spacing-lg)' }}
          >
            ← Back
          </button>

          <h2 style={{ marginBottom: 'var(--spacing-xl)', textAlign: 'center' }}>Join Game</h2>

          <form onSubmit={handleJoinGame} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            <div>
              <label htmlFor="playerName" className="label">Your Name</label>
              <input
                id="playerName"
                type="text"
                className="input"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="roomCode" className="label">Room Code</label>
              <input
                id="roomCode"
                type="text"
                className="input input-large"
                placeholder="ABCD"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={4}
                autoComplete="off"
              />
            </div>

            {error && (
              <p style={{ color: 'var(--color-error)', fontSize: '0.875rem', textAlign: 'center' }}>
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary btn-large btn-full">
              Join Game
            </button>
          </form>
        </div>
      )}

      {/* How to Play */}
      <div className="animate-fade-in" style={{ marginTop: 'var(--spacing-2xl)', textAlign: 'center', maxWidth: '600px' }}>
        <h3 style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>How to Play</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--spacing-lg)' }}>
          <div style={{ padding: 'var(--spacing-md)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>❓</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Read the trivia question</p>
          </div>
          <div style={{ padding: 'var(--spacing-md)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>✍️</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Write a convincing fake answer</p>
          </div>
          <div style={{ padding: 'var(--spacing-md)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>🗳️</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Vote for the real answer</p>
          </div>
          <div style={{ padding: 'var(--spacing-md)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>🏆</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Score points & win!</p>
          </div>
        </div>
      </div>
    </main>
  );
}
