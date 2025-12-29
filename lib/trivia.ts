import type { Question } from './game-types';

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

// Fetch questions from Open Trivia Database
export async function fetchTriviaQuestions(count: number = 10): Promise<Question[]> {
  console.log(`[Trivia] Fetching ${count} questions from Open Trivia DB...`);

  try {
    const url = `https://opentdb.com/api.php?amount=${count}&type=multiple`;
    console.log(`[Trivia] Fetching from: ${url}`);

    const response = await fetch(url);
    console.log(`[Trivia] Response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[Trivia] HTTP error: ${response.status} ${response.statusText}`);
      throw new Error('Failed to fetch trivia questions');
    }

    const data: OpenTDBResponse = await response.json();
    console.log(`[Trivia] API response_code: ${data.response_code}, results: ${data.results?.length || 0}`);

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
        // Filter out NOT/EXCEPT type questions
        const isBadQuestion = badQuestionPatterns.some(pattern => pattern.test(text));
        if (isBadQuestion) {
          console.log(`[Trivia] Filtered out bad question type: "${text.slice(0, 50)}..."`);
        }
        return !isBadQuestion;
      })
      .map((q, index) => ({
        id: `q-${Date.now()}-${index}`,
        text: decodeHTML(q.question),
        correctAnswer: decodeHTML(q.correct_answer),
        category: decodeHTML(q.category),
        difficulty: q.difficulty as 'easy' | 'medium' | 'hard'
      }));

    console.log(`[Trivia] Successfully fetched ${questions.length} valid questions (filtered ${data.results.length - questions.length} bad questions)`);
    return questions;
  } catch (error) {
    console.error('[Trivia] Error fetching trivia:', error);
    console.log('[Trivia] Using fallback questions');
    // Return fallback questions
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
