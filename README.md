# Fibbage AI 🎭

A real-time multiplayer trivia game where players and AI compete to create the most convincing lies. Built with Next.js, PartyKit, and Claude AI.

## 🎮 How to Play

1. **Host** creates a game and shares the room code
2. **Players** (2-8) join using the code on their devices
3. Each round:
   - A trivia question appears
   - Everyone writes a fake answer to fool others
   - AI generates its own convincing lie
   - Vote for what you think is the REAL answer
4. **Score points** for guessing correctly AND tricking others!

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 with TypeScript
- **Real-time**: PartyKit (WebSocket-based multiplayer)
- **AI**: Claude API (Anthropic) for fake answer generation
- **Trivia**: Open Trivia Database
- **Fuzzy Matching**: Fuse.js for typo-tolerant answer validation
- **Deployment**: Vercel + PartyKit Cloud

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Anthropic API key (for Claude)
- PartyKit account

### Local Development

1. **Clone and install:**
   \`\`\`bash
   git clone <your-repo>
   cd fibbage
   npm install
   \`\`\`

2. **Set up environment variables:**
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`
   
   Edit \`.env.local\` and add your Anthropic API key:
   \`\`\`
   ANTHROPIC_API_KEY=your_key_here
   NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999
   \`\`\`

3. **Start development servers:**
   
   Terminal 1 - PartyKit server:
   \`\`\`bash
   npm run party:dev
   \`\`\`
   
   Terminal 2 - Next.js:
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Open the game:**
   - Host screen: http://localhost:3000
   - Join on other devices/tabs

## 📦 Deployment

### Deploy PartyKit Server

\`\`\`bash
# Set API key as environment variable
npx partykit env add ANTHROPIC_API_KEY

# Deploy
npm run party:deploy
\`\`\`

Note the deployed URL (e.g., \`fibbage-server.your-username.partykit.dev\`)

### Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables:
   - \`ANTHROPIC_API_KEY\`: Your Claude API key
   - \`NEXT_PUBLIC_PARTYKIT_HOST\`: Your deployed PartyKit URL

## 🎯 Game Configuration

Hosts can configure:
- **Rounds**: 3, 5, 7, 10, or 15
- **Answer Time**: 30-120 seconds (default: 60)
- **Voting Time**: 30-90 seconds (default: 45)

## 📊 Scoring

| Action | Points |
|--------|--------|
| Guess correct answer | +1000 |
| Fool another player | +500 per player |

## 📁 Project Structure

\`\`\`
fibbage/
├── app/                    # Next.js pages
│   ├── page.tsx           # Home/join screen
│   ├── host/[roomId]/     # Host game board
│   └── play/[roomId]/     # Player controller
├── party/
│   └── index.ts           # PartyKit game server
├── lib/
│   ├── game-types.ts      # TypeScript types
│   ├── trivia.ts          # Question fetching
│   ├── claude.ts          # AI integration
│   ├── fuzzy-match.ts     # Answer matching
│   └── usePartySocket.ts  # React hook
└── partykit.json          # PartyKit config
\`\`\`

## 📄 License

MIT
