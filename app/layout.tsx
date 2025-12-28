import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Fibbage AI - The Bluffing Trivia Game',
  description: 'A multiplayer trivia game where players and AI compete to create the most convincing lies. Can you spot the truth?',
  keywords: ['trivia', 'game', 'multiplayer', 'party game', 'fibbage', 'AI'],
  authors: [{ name: 'Fibbage AI' }],
  openGraph: {
    title: 'Fibbage AI - The Bluffing Trivia Game',
    description: 'A multiplayer trivia game where players and AI compete to create the most convincing lies.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
