import type { Question } from './game-types';
import { generateTriviaQuestion } from './claude';

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
let fallbackQuestionCache: Question[] = [];

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

// Fetch a single question - uses OpenTrivia DB first (verified facts), Claude as fallback
export async function fetchSingleQuestion(apiKey?: string, previousQuestions: string[] = []): Promise<Question> {
  console.log('[Trivia] Fetching single question (OpenTrivia DB first for verified facts)...');

  // Try to use cached verified questions first (from OpenTrivia DB)
  if (fallbackQuestionCache.length > 0) {
    const question = fallbackQuestionCache.shift()!;
    console.log(`[Trivia] Using verified question: "${question.text.slice(0, 50)}..."`);

    // Refill cache in background if running low
    if (fallbackQuestionCache.length < 3) {
      fetchFromOpenTriviaDB(10).then(qs => {
        fallbackQuestionCache.push(...qs);
        console.log(`[Trivia] Refilled cache, now ${fallbackQuestionCache.length} questions`);
      }).catch(e => console.warn('[Trivia] Background refill failed:', e));
    }

    return question;
  }

  // No cached questions - fetch from OpenTrivia DB
  console.log('[Trivia] Cache empty, fetching from Open Trivia DB...');
  try {
    const questions = await fetchFromOpenTriviaDB(10);
    if (questions.length > 0) {
      fallbackQuestionCache.push(...questions.slice(1)); // Cache the rest
      console.log(`[Trivia] Got ${questions.length} verified questions, cached ${fallbackQuestionCache.length}`);
      return questions[0];
    }
  } catch (error) {
    console.error('[Trivia] OpenTrivia DB fetch failed:', error);
  }

  // Last resort: try Claude (may have minor inaccuracies)
  console.log('[Trivia] Falling back to Claude for question generation...');
  try {
    const question = await generateTriviaQuestion(apiKey, previousQuestions);
    if (question) {
      console.log(`[Trivia] Claude generated: "${question.text.slice(0, 50)}..." (unverified)`);
      return question;
    }
  } catch (error) {
    console.error('[Trivia] Claude question generation failed:', error);
  }

  // Absolute last resort: static fallback
  console.log('[Trivia] Using static fallback question');
  return getFallbackQuestions()[Math.floor(Math.random() * getFallbackQuestions().length)];
}

// Fetch multiple questions - uses OpenTrivia DB first (verified), Claude to supplement if needed
export async function fetchTriviaQuestions(count: number = 10, apiKey?: string): Promise<Question[]> {
  console.log(`[Trivia] Fetching ${count} verified questions from Open Trivia DB...`);

  // Primary source: OpenTrivia DB (verified facts)
  const verifiedQuestions = await fetchFromOpenTriviaDB(count + 5); // Get extra in case some are filtered

  if (verifiedQuestions.length >= count) {
    console.log(`[Trivia] Got ${verifiedQuestions.length} verified questions`);
    return verifiedQuestions.slice(0, count);
  }

  // Need more - try Claude as supplement (may have minor inaccuracies)
  const needed = count - verifiedQuestions.length;
  console.log(`[Trivia] Need ${needed} more questions, supplementing with Claude...`);

  const claudePromises = Array.from({ length: needed }, (_, i) =>
    generateTriviaQuestion(apiKey, verifiedQuestions.map(q => q.text)).catch(error => {
      console.error(`[Trivia] Claude question ${i + 1} failed:`, error);
      return null;
    })
  );

  const results = await Promise.allSettled(claudePromises);
  const claudeQuestions: Question[] = results
    .filter((r): r is PromiseFulfilledResult<Question | null> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value as Question);

  console.log(`[Trivia] Claude supplemented with ${claudeQuestions.length} additional questions`);

  return [...verifiedQuestions, ...claudeQuestions].slice(0, count);
}

// Fetch questions from Open Trivia Database (fallback)
async function fetchFromOpenTriviaDB(count: number): Promise<Question[]> {
  console.log(`[Trivia] Fetching ${count} questions from Open Trivia DB as fallback...`);

  try {
    // Request more questions than needed since we may filter some out
    const requestCount = Math.min(count * 2, 50);

    // Use medium difficulty - challenging but understandable
    const url = `https://opentdb.com/api.php?amount=${requestCount}&difficulty=medium&type=multiple`;
    console.log(`[Trivia] Fetching from: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data: OpenTDBResponse = await response.json();

    if (data.response_code !== 0 || !data.results) {
      throw new Error(`API error code: ${data.response_code}`);
    }

    console.log(`[Trivia] Got ${data.results.length} questions from API`);

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

    const questions = data.results
      .filter(q => {
        const text = decodeHTML(q.question);
        const isBadQuestion = badQuestionPatterns.some(pattern => pattern.test(text));
        if (isBadQuestion) {
          console.log(`[Trivia] Filtered out: "${text.slice(0, 50)}..."`);
        }
        return !isBadQuestion;
      })
      .map((q, index) => ({
        id: `q-${Date.now()}-${index}`,
        text: decodeHTML(q.question),
        correctAnswer: decodeHTML(q.correct_answer),
        category: decodeHTML(q.category),
        difficulty: q.difficulty as 'easy' | 'medium' | 'hard'
      }))
      .slice(0, count);

    console.log(`[Trivia] Returning ${questions.length} valid questions`);
    return questions;
  } catch (error) {
    console.error('[Trivia] Error fetching from Open Trivia DB:', error);
    console.log('[Trivia] Using static fallback questions');
    return getFallbackQuestions().slice(0, count);
  }
}

// Fallback questions in case API fails
function getFallbackQuestions(): Question[] {
  return [
    {
      id: 'fallback-1',
      text: 'What was the original name for the butterfly?',
      correctAnswer: 'Flutterby',
      category: 'Nature',
      difficulty: 'medium'
    },
    {
      id: 'fallback-2',
      text: 'What animal was incorrectly thought to spontaneously generate from mud?',
      correctAnswer: 'Frogs',
      category: 'Science',
      difficulty: 'medium'
    },
    {
      id: 'fallback-3',
      text: 'What color were carrots before the 17th century?',
      correctAnswer: 'Purple',
      category: 'History',
      difficulty: 'medium'
    },
    {
      id: 'fallback-4',
      text: 'What is the fear of peanut butter sticking to the roof of your mouth called?',
      correctAnswer: 'Arachibutyrophobia',
      category: 'Science',
      difficulty: 'hard'
    },
    {
      id: 'fallback-5',
      text: 'In what country was the first-ever speeding ticket issued?',
      correctAnswer: 'England',
      category: 'History',
      difficulty: 'medium'
    }
  ];
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
