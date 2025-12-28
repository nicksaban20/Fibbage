import Fuse from 'fuse.js';

interface FuzzyMatchResult {
  isMatch: boolean;
  score: number; // 0 = perfect match, 1 = no match
  matchedText: string;
}

// Normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Remove common articles
    .replace(/^(the|a|an)\s+/i, '')
    // Remove punctuation
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if a player's answer matches the correct answer
export function checkAnswerMatch(
  playerAnswer: string,
  correctAnswer: string,
  threshold: number = 0.3 // Lower = stricter matching
): FuzzyMatchResult {
  const normalized = normalizeText(playerAnswer);
  const normalizedCorrect = normalizeText(correctAnswer);
  
  // Exact match after normalization
  if (normalized === normalizedCorrect) {
    return { isMatch: true, score: 0, matchedText: correctAnswer };
  }
  
  // Use Fuse.js for fuzzy matching
  const fuse = new Fuse([normalizedCorrect], {
    includeScore: true,
    threshold: threshold,
    distance: 100,
    minMatchCharLength: 2,
  });
  
  const results = fuse.search(normalized);
  
  if (results.length > 0 && results[0].score !== undefined) {
    return {
      isMatch: results[0].score <= threshold,
      score: results[0].score,
      matchedText: correctAnswer
    };
  }
  
  return { isMatch: false, score: 1, matchedText: '' };
}

// Check if a submitted answer is too similar to the correct answer
// (to prevent players from just submitting the real answer as their "fake")
export function isTooSimilarToCorrect(
  submittedAnswer: string,
  correctAnswer: string,
  threshold: number = 0.2 // Stricter threshold for similarity check
): boolean {
  const result = checkAnswerMatch(submittedAnswer, correctAnswer, threshold);
  return result.isMatch;
}

// Shuffle an array (Fisher-Yates)
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Generate a unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Generate a room code (4 uppercase letters)
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding I and O to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
