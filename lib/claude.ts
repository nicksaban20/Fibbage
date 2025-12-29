import Anthropic from '@anthropic-ai/sdk';
import type { Question } from './game-types';
import { buildQuestionContext } from './trivia';
import { getWikipediaContext, buildRAGPromptContext, type WikiFact } from './wikipedia';
import { validateAIAnswer } from './validation';

// Initialize Anthropic client
function getClient(apiKey?: string): Anthropic {
  const finalApiKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!finalApiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey: finalApiKey });
}

// Extract search terms from question for Wikipedia lookup
function extractSearchQuery(question: Question): string {
  // Remove question words and get key terms
  const stopWords = ['what', 'which', 'who', 'where', 'when', 'why', 'how', 'is', 'are', 'was', 'were', 'the', 'a', 'an'];
  const words = question.text.toLowerCase()
    .replace(/[?.,!'"]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));

  return words.slice(0, 4).join(' ');
}

// Generate a convincing fake answer using Claude with RAG context
export async function generateFakeAnswer(question: Question, apiKey?: string): Promise<string> {
  try {
    const client = getClient(apiKey);

    // Fetch Wikipedia context for grounding
    let wikiFact: WikiFact | null = null;
    try {
      const searchQuery = extractSearchQuery(question);
      wikiFact = await getWikipediaContext(searchQuery);
    } catch (error) {
      console.warn('Wikipedia fetch failed, continuing without RAG context:', error);
    }

    // Build context with RAG information
    const baseContext = buildQuestionContext(question);
    const ragContext = buildRAGPromptContext(wikiFact, question.correctAnswer);

    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `You are an expert at Fibbage, a trivia game where you create convincing fake answers to fool other players.

QUESTION: "${question.text}"
CATEGORY: ${question.category}
THE REAL ANSWER IS: "${question.correctAnswer}"

${ragContext}

YOUR TASK: Generate ONE fake answer that:
1. Is the SAME TYPE as the real answer (if real answer is a person's name, your fake should be a person's name; if it's a place, yours should be a place; if it's a number, yours should be a number, etc.)
2. Sounds PLAUSIBLE for this specific question - it should be something players might actually believe
3. Is CLEARLY WRONG - not the real answer or a correct alternative
4. Has SIMILAR LENGTH and FORMAT to the real answer "${question.correctAnswer}"

RESPOND WITH ONLY THE FAKE ANSWER - no quotes, no explanation, no punctuation unless the answer requires it.

Your fake answer:`
        }
      ]
    });

    // Extract text from response
    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text in response');
    }

    // Clean up the response
    let fakeAnswer = textBlock.text.trim();
    // Remove quotes if present
    fakeAnswer = fakeAnswer.replace(/^["']|["']$/g, '');
    // Remove any leading phrases
    fakeAnswer = fakeAnswer.replace(/^(The answer is|I would say|How about|Maybe|Perhaps)[:\s]*/i, '');

    // Validate the AI answer to ensure it's not too similar to correct answer
    const validation = await validateAIAnswer(fakeAnswer, question);
    if (!validation.isValid) {
      console.warn('AI answer failed validation, using fallback:', validation.reason);
      return generateFallbackFakeAnswer(question);
    }

    return fakeAnswer;
  } catch (error) {
    console.error('Error generating fake answer:', error);
    // Return a generic fallback
    return generateFallbackFakeAnswer(question);
  }
}

// Fallback fake answer generator
function generateFallbackFakeAnswer(question: Question): string {
  const fallbacks: Record<string, string[]> = {
    'Science': ['Quantum fluctuation', 'Molecular resonance', 'Thermal dynamics', 'Photosynthetic reaction'],
    'History': ['King George III', 'The Romans', 'Ancient Egypt', 'The Ming Dynasty'],
    'Geography': ['The Amazon', 'Mount Kilimanjaro', 'The Sahara', 'Greenland'],
    'Entertainment': ['Steven Spielberg', 'The Beatles', 'Hollywood Studios', 'MGM Studios'],
    'Sports': ['The Olympics', 'World Cup 1966', 'Jesse Owens', 'Babe Ruth'],
    'Art': ['Leonardo da Vinci', 'The Renaissance', 'Impressionism', 'Van Gogh'],
    'default': ['Unknown origin', 'Ancient times', 'Scientists disagree', 'Lost to history']
  };

  const category = Object.keys(fallbacks).find(cat =>
    question.category.toLowerCase().includes(cat.toLowerCase())
  ) || 'default';

  const options = fallbacks[category];
  return options[Math.floor(Math.random() * options.length)];
}

// Validate that an answer is not too similar to the correct answer
export function isValidFakeAnswer(fakeAnswer: string, correctAnswer: string): boolean {
  const fake = fakeAnswer.toLowerCase().trim();
  const correct = correctAnswer.toLowerCase().trim();

  // Check if they're too similar
  if (fake === correct) return false;
  if (fake.includes(correct) || correct.includes(fake)) return false;

  // Check Levenshtein distance for short answers
  if (correct.length < 15) {
    const distance = levenshteinDistance(fake, correct);
    if (distance < 3) return false;
  }

  return true;
}

// Simple Levenshtein distance implementation
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
