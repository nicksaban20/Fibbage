import type { Question } from './game-types';
import { generateTriviaQuestion } from './claude';
import { FALLBACK_QUESTIONS } from './fallback-questions';

interface OpenTDBQuestion {
  category: string;
  type: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface OpenTDBResponse {
  response_code: number;
  results: OpenTDBQuestion[];
}

// Cache for pre-fetched fallback questions
const fallbackQuestionCache: Question[] = [];

// Decode HTML entities
function decodeHTML(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&ndash;': '–',
    '&mdash;': '—',
    '&nbsp;': ' ',
    '&hellip;': '…',
    '&eacute;': 'é',
    '&Eacute;': 'É',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)));
  decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return decoded;
}

// Fetch a single question - uses Claude first for variety, OpenTrivia DB as fallback
export async function fetchSingleQuestion(
  apiKey?: string,
  previousQuestions: string[] = [],
  shouldVerify: boolean = false,
  model: string = 'claude-haiku-4-5-20251001'
): Promise<Question> {
  console.log(`[Trivia] Fetching single question (Model: ${model})...`);

  // Try Claude first (with random category and temperature for variety)
  try {
    const question = await generateTriviaQuestion(apiKey, previousQuestions, shouldVerify, model);
    if (question) {
      console.log(`[Trivia] Claude generated: "${question.text.slice(0, 50)}..." (category: ${question.category})`);
      return question;
    }
  } catch (error) {
    console.error('[Trivia] Claude question generation failed:', error);
  }

  // Fallback to cached questions (from OpenTrivia DB)
  console.log('[Trivia] Claude failed, trying OpenTrivia DB fallback...');
  if (fallbackQuestionCache.length > 0) {
    const question = fallbackQuestionCache.shift()!;
    console.log(`[Trivia] Using cached fallback: "${question.text.slice(0, 50)}..."`);
    return question;
  }

  // No cached questions - fetch from OpenTrivia DB
  /* 
   * DISABLED OPENTRIVIA DB FALLBACK 
   * Reason: OpenTriviaDB questions are often too easy/generic (e.g., "Largest organ is skin").
   * We want to strictly enforce "Obscure/Hard" difficulty, so if AI fails, we use our curated static list.
   */
  /*
  try {
    const questions = await fetchFromOpenTriviaDB(10);
    if (questions.length > 0) {
      fallbackQuestionCache.push(...questions.slice(1)); // Cache the rest
      console.log(`[Trivia] Got ${questions.length} fallback questions, cached ${fallbackQuestionCache.length}`);
      return questions[0];
    }
  } catch (error) {
    console.error('[Trivia] OpenTrivia DB fetch failed:', error);
  }
  */

  // Absolute last resort: static fallback
  console.log('[Trivia] Using static fallback question');
  return getFallbackQuestions()[Math.floor(Math.random() * getFallbackQuestions().length)];
}

// Fetch multiple questions - uses Claude first (parallel), OpenTrivia DB as fallback
export async function fetchTriviaQuestions(count: number = 10, apiKey?: string): Promise<Question[]> {
  console.log(`[Trivia] Generating ${count} questions with Claude (parallel)...`);

  // Primary source: Claude (parallel for speed, with variety from temperature/categories)
  const claudePromises = Array.from({ length: count }, (_, i) =>
    generateTriviaQuestion(apiKey, []).catch(error => {
      console.error(`[Trivia] Claude question ${i + 1} failed:`, error);
      return null;
    })
  );

  const results = await Promise.allSettled(claudePromises);
  const claudeQuestions: Question[] = results
    .filter((r): r is PromiseFulfilledResult<Question | null> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value as Question);

  console.log(`[Trivia] Claude generated ${claudeQuestions.length}/${count} questions`);

  // If we got enough from Claude, use them
  if (claudeQuestions.length >= count) {
    return claudeQuestions.slice(0, count);
  }

  // Fallback: supplement with OpenTrivia DB
  const needed = count - claudeQuestions.length;
  console.log(`[Trivia] Need ${needed} more, using static fallbacks instead of OpenTriviaDB...`);

  /*
  const fallbackQuestions = await fetchFromOpenTriviaDB(needed + 3);
  console.log(`[Trivia] Got ${fallbackQuestions.length} fallback questions`);
  return [...claudeQuestions, ...fallbackQuestions].slice(0, count);
  */

  // Use static fallbacks randomized
  const staticFallbacks = getFallbackQuestions().sort(() => 0.5 - Math.random()).slice(0, needed);
  return [...claudeQuestions, ...staticFallbacks];
}

// Fetch questions from Open Trivia Database (fallback)
export async function fetchFromOpenTriviaDB(count: number): Promise<Question[]> {
  console.log(`[Trivia] Fetching ${count} questions from Open Trivia DB...`);

  // Categories good for Fibbage (ID: Name)
  // 9: General Knowledge, 17: Science & Nature, 18: Computers, 
  // 19: Mathematics, 20: Mythology, 21: Sports, 22: Geography,
  // 23: History, 25: Art, 26: Celebrities, 27: Animals
  const categories = [9, 17, 18, 20, 21, 22, 23, 25, 26, 27];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];

  // Mix difficulties for variety
  const difficulties = ['easy', 'medium', 'hard'];
  const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];

  try {
    // Request more questions than needed since we may filter some out
    const requestCount = Math.min(count * 2, 50);

    // Use random category and difficulty for variety
    const url = `https://opentdb.com/api.php?amount=${requestCount}&category=${randomCategory}&difficulty=${randomDifficulty}&type=multiple`;
    console.log(`[Trivia] Fetching from: ${url} (category=${randomCategory}, difficulty=${randomDifficulty})`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data: OpenTDBResponse = await response.json();

    if (data.response_code !== 0 || !data.results) {
      // If no results for this category, try without category filter
      console.log('[Trivia] Category returned no results, trying without category filter...');
      const fallbackUrl = `https://opentdb.com/api.php?amount=${requestCount}&type=multiple`;
      const fallbackResponse = await fetch(fallbackUrl);
      if (fallbackResponse.ok) {
        const fallbackData: OpenTDBResponse = await fallbackResponse.json();
        if (fallbackData.response_code === 0 && fallbackData.results) {
          return processOpenTDBResults(fallbackData.results, count);
        }
      }
      throw new Error(`API error code: ${data.response_code}`);
    }

    return processOpenTDBResults(data.results, count);
  } catch (error) {
    console.error('[Trivia] Error fetching from Open Trivia DB:', error);
    console.log('[Trivia] Using static fallback questions');
    return getFallbackQuestions().slice(0, count);
  }
}

// Process and filter OpenTrivia DB results
function processOpenTDBResults(results: OpenTDBQuestion[], count: number): Question[] {
  console.log(`[Trivia] Processing ${results.length} questions from API`);

  // Filter out problematic question types
  const badQuestionPatterns = [
    /which of these.+not/i,
    /which of the following.+not/i,
    /which.+is not/i,
    /which.+isn't/i,
    /which.+are not/i,
    /which.+except/i,
    /all of the following except/i,
    /none of the above/i,
    /all of the above/i,
  ];

  const questions = results
    .filter(q => {
      const text = decodeHTML(q.question);
      const isBadQuestion = badQuestionPatterns.some(pattern => pattern.test(text));
      if (isBadQuestion) {
        console.log(`[Trivia] Filtered out: "${text.slice(0, 50)}..."`);
      }
      return !isBadQuestion;
    })
    .map((q, index) => ({
      id: `q-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      text: decodeHTML(q.question),
      correctAnswer: decodeHTML(q.correct_answer),
      category: decodeHTML(q.category),
      difficulty: q.difficulty as 'easy' | 'medium' | 'hard'
    }))
    .slice(0, count);

  console.log(`[Trivia] Returning ${questions.length} valid questions`);
  return questions;
}

// Fallback questions in case API fails (Curated High-Difficulty / Fibbage Style)
// Fallback questions in case API fails (Curated High-Difficulty / Fibbage Style)
export function getFallbackQuestions(): Question[] {
  return FALLBACK_QUESTIONS;
}

// Build context for AI to generate plausible fake answers
export function buildQuestionContext(question: Question): string {
  return `
Question: "${question.text}"
Category: ${question.category}
Difficulty: ${question.difficulty}
The real answer is: "${question.correctAnswer}"

Based on this, generate a fake answer that:
1. Sounds highly plausible and could fool players
2. Is clearly wrong (not the real answer)
3. Matches the style and format of the real answer
4. Is believable given the category and difficulty
`.trim();
}
