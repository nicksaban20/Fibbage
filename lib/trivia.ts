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
  try {
    const response = await fetch(
      `https://opentdb.com/api.php?amount=${count}&type=multiple`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch trivia questions');
    }

    const data: OpenTDBResponse = await response.json();

    if (data.response_code !== 0) {
      throw new Error('Trivia API returned an error');
    }

    return data.results.map((q, index) => ({
      id: `q-${Date.now()}-${index}`,
      text: decodeHTML(q.question),
      correctAnswer: decodeHTML(q.correct_answer),
      category: decodeHTML(q.category),
      difficulty: q.difficulty as 'easy' | 'medium' | 'hard'
    }));
  } catch (error) {
    console.error('Error fetching trivia:', error);
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
