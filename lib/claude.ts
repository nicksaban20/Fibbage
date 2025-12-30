import Anthropic from '@anthropic-ai/sdk';
import type { Question } from './game-types';
import { buildQuestionContext } from './trivia';
import { validateAIAnswer } from './validation';

// Initialize Anthropic client with validation
function getClient(apiKey?: string): Anthropic {
  const finalApiKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!finalApiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey: finalApiKey });
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Claude] Attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`[Claude] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retries failed');
}

// Generate a convincing fake answer using Claude (simplified, no Wikipedia for speed)
export async function generateFakeAnswer(question: Question, apiKey?: string): Promise<string> {
  try {
    const client = getClient(apiKey);

    const response = await withRetry(async () => {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `You are playing Fibbage. Generate ONE believable fake answer.

QUESTION: "${question.text}"
CATEGORY: ${question.category}
REAL ANSWER (do NOT use this): "${question.correctAnswer}"

Rules:
- Same format/length as real answer
- Sounds plausible but is WRONG
- NO quotes, NO explanation, just the fake answer

Fake answer:`
          }
        ]
      });

      return message;
    });

    // Extract text from response
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text in response');
    }

    // Clean up the response
    let fakeAnswer = textBlock.text.trim();
    // Remove quotes if present
    fakeAnswer = fakeAnswer.replace(/^[\"']|[\"']$/g, '');
    // Remove any leading phrases
    fakeAnswer = fakeAnswer.replace(/^(The answer is|I would say|How about|Maybe|Perhaps|Fake answer:?)[:\s]*/i, '');
    // Limit length
    fakeAnswer = fakeAnswer.substring(0, 100);

    console.log(`[Claude] Generated fake answer: "${fakeAnswer}" for question: "${question.text.slice(0, 50)}..."`);

    // Validate the AI answer to ensure it's not too similar to correct answer
    const validation = validateAIAnswer(fakeAnswer, question);
    if (!validation.isValid) {
      console.warn(`[Claude] AI answer failed validation: ${validation.reason}, regenerating...`);
      // Try once more with explicit instruction to be different
      return await generateDifferentFakeAnswer(question, apiKey, question.correctAnswer);
    }

    return fakeAnswer;
  } catch (error) {
    console.error('[Claude] Error generating fake answer after retries:', error);
    // Return a generic fallback
    return generateFallbackFakeAnswer(question);
  }
}

// Second attempt with more explicit instructions
async function generateDifferentFakeAnswer(question: Question, apiKey: string | undefined, avoidAnswer: string): Promise<string> {
  try {
    const client = getClient(apiKey);

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Generate a fake answer for this trivia question. Must be COMPLETELY DIFFERENT from "${avoidAnswer}".

Question: "${question.text}"
Category: ${question.category}

Reply with just the fake answer, nothing else:`
        }
      ]
    });

    const textBlock = message.content.find(block => block.type === 'text');
    if (textBlock && textBlock.type === 'text') {
      let answer = textBlock.text.trim().replace(/^[\"']|[\"']$/g, '');
      if (answer.length > 0 && answer.length <= 100) {
        return answer;
      }
    }
  } catch (error) {
    console.error('[Claude] Second attempt also failed:', error);
  }

  return generateFallbackFakeAnswer(question);
}

import { verifyFactWithSearch } from './verification';

// Generate a Fibbage-style trivia question using Claude
export async function generateTriviaQuestion(apiKey?: string, previousQuestions: string[] = [], shouldVerify: boolean = false): Promise<Question | null> {
  const MAX_GENERATION_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    try {
      const client = getClient(apiKey);


      // Random category for variety
      const categories = [
        'Science & Nature', 'History', 'Geography', 'Entertainment',
        'Sports', 'Art & Literature', 'Music', 'Food & Drink',
        'Animals', 'Technology', 'Pop Culture', 'Movies & TV',
        'Mythology', 'Language & Words', 'Weird Facts'
      ];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];

      // Random style modifiers for variety between games
      const styles = [
        'obscure and little-known',
        'surprising and counterintuitive',
        'funny or amusing',
        'mind-blowing',
        'historical',
        'scientific',
        'cultural',
        'bizarre but true'
      ];
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];

      // Temporal seed to vary questions by time (changes every hour)
      const now = new Date();
      const timeSeed = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;

      // Random sub-topic for even more variety
      const subTopics = [
        'from the 1800s', 'from ancient times', 'about famous people',
        'about inventions', 'about world records', 'about origins of things',
        'about unusual laws', 'about body parts', 'about countries',
        'about space', 'about the ocean', 'about plants'
      ];
      const randomSubTopic = subTopics[Math.floor(Math.random() * subTopics.length)];

      const previousQuestionsContext = previousQuestions.length > 0
        ? `\n\nDO NOT USE THESE TOPICS (already used in this game):\n${previousQuestions.slice(-10).join('\n')}`
        : '';

      const response = await withRetry(async () => {
        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          temperature: 0.95, // Even higher for maximum variety
          messages: [
            {
              role: 'user',
              content: `Generate ONE unique Fibbage trivia question.

TOPIC: ${randomCategory} - specifically something ${randomStyle} ${randomSubTopic}
SESSION: ${timeSeed}-${Math.random().toString(36).slice(2, 6)}

FIBBAGE: A party game where players see a fill-in-the-blank question and try to fool others with fake answers.

REQUIREMENTS:
- Must be ${randomStyle} fact about ${randomCategory}
- Must be TRUE and verifiable
- Must be UNBELIEVABLY OBSCURE (Graduate/Archive level difficulty)
- Facts should sound fake but be 100% true (The Fibbage Effect)
- Answer should be 1-4 words
- Use _____ for each word in the answer (e.g., "_____ _____" for a 2-word answer)
- Avoid common trivia like the plague (no flamingos, no butterflies, no octopuses)
- Be CREATIVE - surprise the players with how wild the fact is!
- **CRITICAL: The question must be OPEN-ENDED.** It must be possible to imagine 50 different plausible fake answers.
- AVOID questions where the answer is obviously a country, a year, or a color unless it's impossible to guess.

EXAMPLES OF DIFFICULTY & OPENNESS:
BAD (Too Easy): "The _____ is known as the 'king of the jungle'." (Answer: Lion) -> REJECT.
BAD (Common Fact): "The Eiffel Tower is located in _____." (Answer: Paris) -> REJECT.
BAD (Too Narrow): "The capital of France is _____." (Answer: Paris) -> REJECT (Only one plausible guess).
GOOD (Specific & Obscure): "The first item ever sold on eBay was a broken _____ pointer." (Answer: Laser) -> GOOD (Could be: Laser, Stick, Mouse, Clock, Toy, etc.)
GOOD (Weird History): "During WWII, the US military tried to train _____ to guide missiles." (Answer: Pigeons) -> GOOD (Could be: Dogs, Cats, Bats, Rats, etc.)
GOOD (Open Context): "In 1850, the city of Paris passed a law forbidding women from _____." (Answer: Wearing Pants) -> GOOD (Could be: Smoking, Walking, Singing, etc.)

${previousQuestionsContext}

FORMAT:
QUESTION: [question with _____ for EACH word in the answer]
ANSWER: [1-4 word answer]
CATEGORY: ${randomCategory}`
            }
          ]
        });
        return message;
      });

      const textBlock = response.content.find(block => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        console.error('[Claude] No text in trivia question response');
        return null;
      }

      const responseText = textBlock.text.trim();
      console.log('[Claude] Generated trivia question response:', responseText);

      // Parse response - using simpler regex patterns for compatibility
      const questionMatch = responseText.match(/QUESTION:\s*([^\n]+)/i);
      const answerMatch = responseText.match(/ANSWER:\s*([^\n]+)/i);
      const categoryMatch = responseText.match(/CATEGORY:\s*([^\n]+)/i);

      if (!questionMatch || !answerMatch) {
        console.error('[Claude] Failed to parse trivia question response');
        return null;
      }

      const questionText = questionMatch[1].trim();
      let answer = answerMatch[1].trim();
      // Clean up answer - remove quotes, extra whitespace
      answer = answer.replace(/^[\"'\s]+|[\"'\s]+$/g, '');
      const category = categoryMatch ? categoryMatch[1].trim().replace(/^[\"'\s]+|[\"'\s]+$/g, '') : 'General';

      // Validation
      if (answer.length < 1 || answer.length > 60) {
        console.error('[Claude] Answer length invalid:', answer.length);
        continue;
      }

      if (questionText.length < 10) {
        console.error('[Claude] Question too short:', questionText.length);
        continue;
      }

      // Count words in answer to format blanks correctly
      const wordCount = answer.split(/\s+/).filter(w => w.length > 0).length;
      const blanks = Array(wordCount).fill('_____').join(' ');

      // Replace any underscore pattern with the correct number of blanks
      let formattedQuestion = questionText.replace(/_+(?:\s+_+)*/g, blanks);

      // If no blanks found, append them
      if (!formattedQuestion.includes('_____')) {
        formattedQuestion = formattedQuestion.replace(/\.\s*$/, '') + ' ' + blanks + '.';
      }

      return {
        id: `claude-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: formattedQuestion,
        correctAnswer: answer,
        category: category,
        difficulty: 'medium' as const
      };
    } catch (error) {
      console.error('[Claude] Error generating trivia question after retries:', error);
      return null;
    }
  }
  return null;
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
