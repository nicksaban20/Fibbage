import Anthropic from '@anthropic-ai/sdk';
import type { Question } from './game-types';
import { buildQuestionContext } from './trivia';

// Initialize Anthropic client
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey });
}

// Generate a convincing fake answer using Claude
export async function generateFakeAnswer(question: Question): Promise<string> {
  try {
    const client = getClient();
    const context = buildQuestionContext(question);
    
    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `You are playing a Fibbage-style trivia game. Your job is to generate ONE convincing but WRONG answer to fool players.

\${context}

IMPORTANT RULES:
- Respond with ONLY the fake answer, nothing else
- Keep it short (1-4 words typically)
- Make it sound believable and plausible
- Do NOT include quotes, explanations, or commentary
- Match the tone and format of the real answer

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
