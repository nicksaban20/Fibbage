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
- MUST BE ONE WORD ONLY (No exceptions)
- Sounds plausible but is WRONG
- NO quotes, NO explanation, just the output
- If the blank allows "a ____", return just the noun (e.g. "Toaster", not "a toaster")

Fake answer (1 word):`
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

Constraint: ONE WORD ONLY.

Reply with just the one-word fake answer:`
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
export async function generateTriviaQuestion(
  apiKey?: string,
  previousQuestions: string[] = [],
  shouldVerify: boolean = false,
  model: string = 'claude-haiku-4-5-20251001'
): Promise<Question | null> {
  const MAX_GENERATION_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    try {
      const client = getClient(apiKey);


      // Temporal seed to vary questions by time (changes every hour)
      const now = new Date();
      const timeSeed = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;

      // Random general category for metadata (not used in prompt)
      const categories = ['General', 'Weird Facts', 'History', 'Science', 'Nature', 'Human Behavior'];
      const randomCategoryLabel = categories[Math.floor(Math.random() * categories.length)];

      const previousQuestionsContext = previousQuestions.length > 0
        ? `\n\nDO NOT USE THESE TOPICS (already used in this game):\n${previousQuestions.slice(-10).join('\n')}`
        : '';

      const response = await withRetry(async () => {
        const message = await client.messages.create({
          model: 'claude-haiku-4-5-20251001', // Using requested 4.5 model
          max_tokens: 300,
          temperature: 0.95, // Even higher for maximum variety
          messages: [
            {
              role: 'user',
              content: `Generate ONE unique Fibbage trivia question.

SESSION: ${timeSeed}-${Math.random().toString(36).slice(2, 6)}

FIBBAGE: A party game where players see a fill-in-the-blank question and try to fool others with fake answers.

REQUIREMENTS:
- Must be TRUE and verifiable
- Must be UNBELIEVABLY OBSCURE (Graduate/Archive level difficulty)
- Facts should sound fake but be 100% true (The Fibbage Effect)
- **QUESTION STRUCTURE:** 
  - **MAX LENGTH:** 15-20 words. Shorter is better.
  - **STYLE:** Punchy, direct, and concise. No fluff.
  - **RULE:** If you can remove a word without changing the fact, REMOVE IT.
  - AVOID lengthy preambles. Start directly with the subject/action if possible.
- Answer should be 1-4 words
- Use _____ for each word in the answer (e.g., "_____ _____" for a 2-word answer)
- Avoid common trivia like the plague (no flamingos, no butterflies, no octopuses)
- Be CREATIVE - surprise the players with how wild the fact is!
- **CRITICAL: The question must be OPEN-ENDED.** It must be possible to imagine 50 different plausible fake answers.
- AVOID questions where the answer is obviously a country, a year, or a color unless it's impossible to guess.
- **SURPRISE FACTOR:** The answer should NOT be the most logical completion of the sentence.
  - BAD: "The recording location was too close to a military _____." (Answer: Base/Submarine) -> Too easy to guess context.
  - GOOD: "The recording location was too close to a military _____." (Answer: Bakery) -> Unexpected!
  - The correct answer should feel "weird" or "funny" in context.

- **AMBIGUITY REQUIREMENT:** Do NOT include descriptive words that give away the answer category.
  - BAD: "Smugglers would hide contraband in hollowed-out loaves of _____." (Answer: Bread) -> "Loaves" reveals it's bread.
  - GOOD: "Smugglers would hide contraband in hollowed-out _____." (Answer: Bread) -> Could be anything (Logs? Books? Shoes?).
  - BAD: "In 1814, a London brewery explosion killed 8 people when 135,000 imperial gallons of _____ burst through the streets." (Answer: Beer) -> "Brewery" implies Alcohol/Beer.
  - GOOD: "In 1814, a London explosion killed 8 people when 135,000 imperial gallons of _____ burst through the streets." (Answer: Beer) -> Now it could be anything (Molasses? Sewage? Gin?).
  - Keep the blank OPEN-ENDED. Eliminate "Context Clues" (venue, container type) immediately before the blank.

- **AVOID PREDICTABLE CAUSE & EFFECT:** The answer must NOT be the purely logical conclusion of the sentence.
  - BAD: "Invented to monitor a coffee pot because people were tired of finding it _____." (Answer: Empty) -> Logic dictates "Empty".
  - GOOD: "The first webcam was invented to monitor a _____." (Answer: Coffee Pot) -> A bit more open, though still tech history.
  - BETTER: "The first webcam was used to monitor a coffee pot, specifically checking for _____." (Answer: Mold/Poison/Aliens) -> (If true).
  - Rule: If the sentence setup makes the answer obvious to a sensible person, IT IS A BAD QUESTION.

ANSWER QUALITY (CRITICAL):
- **LENGTH PREFERENCE:**
  - 1 WORD: Required (100% of the time).
  - 2+ WORDS: NEVER.
- The answer MUST be a simple, common word or phrase (something a drunk person could guess).
- AVOID "Jeopardy Answers" or complex legal/medical terms.
- AVOID answers that are too specific to be guessed (e.g. "Palimony Suit" -> BAD, "Lawsuit" -> GOOD).
- If the answer is a technical term, the question is BAD.
- Good answers are often: common objects, animals, body parts, food, or simple actions.

EXAMPLES OF PERFECT FIBBAGE QUESTIONS (Study the style):
- "Owning 55,000 of them, Ted Turner has the world's largest private collection of _____." (Answer: Bison)
- "A study published in the journal Anthrozoo reported that cows produce 5% more milk when they are given _____." (Answer: Names)
- "The electric chair was invented by a professional _____ named Alfred Southwick." (Answer: Dentist)
- "People in Damariscotta, Maine hold an annual race where they use _____ as boats." (Answer: Pumpkins)
- "Andrew Wilson, a man from Branson, Missouri, legally changed his name to simply _____." (Answer: They)
- "As a young student in Buenos Aires, Pope Francis worked as a _____." (Answer: Bouncer)
- "The name for a group of porcupines is a _____." (Answer: Prickle)
- "The name of the first chimp sent into space was _____." (Answer: Ham)
- "Dr. Seuss is credited with coining this common derogatory term in his 1950 book If I Ran the Zoo: _____." (Answer: Nerd)
- "The original name for the search engine that became Google was _____." (Answer: Backrub)
- "The fishing company E21 makes a very peculiar fishing rod that is composed of 70% _____." (Answer: Carrots)
- "The first reporting on the Wright Brothers' flights appeared not in a newspaper or on radio, but in a small journal dedicated to the topic of _____." (Answer: Beekeeping)
- "There's a novelty museum in Arlington, Massachusetts that only collects food that has been _____." (Answer: Burnt)
- "On January 13, 2014, U.S. Secretary of State John Kerry presented to Russian Foreign Minister Sergei Lavrov the odd gift of two very large _____." (Answer: Potatoes)
- "Suffering from an extremely rare side effect after getting hip surgery in 2010, a Dutch man has alienated his family because he cannot stop _____." (Answer: Laughing)
- "Ben and Jerry only started making ice cream because it was too expensive to make _____." (Answer: Bagels)
- "A spectator in an Illinois courtroom was sentenced to six months in jail for _____ during a trial." (Answer: Yawning)
- "The sports teams at Freeport High School in Illinois are oddly named after an inanimate object. The teams are called the Freeport _____." (Answer: Pretzels)
- "While president of the United States, John Adams had a dog named Juno and a dog named _____." (Answer: Satan)
- "A Kickstarter campaign met its $30,000 goal on April 7, 2012 for its shoes designed for _____." (Answer: Atheists)
- "In 2003, Morocco made the highly unusual offer to send 2,000 _____ to assist the United States' war efforts in Iraq." (Answer: Monkeys)
- "Belmont University in Nashville has offered a class called 'Oh, Look, a _____.'" (Answer: Chicken)
- "Under Peter the Great, noblemen had to pay 100 rubles a year for a _____ license." (Answer: Beard)
- "In 2000, Australia had its largest ever online petition, which called for an end to rising _____ prices." (Answer: Beer)
- "Although very unconventional, farmer William von Schneidau feeds his pigs _____." (Answer: Marijuana)
- "A 2013 Pakistani game show caused a controversy when their grand prize was a _____." (Answer: Baby)

${previousQuestionsContext}

FORMAT:
QUESTION: [question with _____ for EACH word in the answer]
ANSWER: [1 word answer]`
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

      // Verification Step
      if (shouldVerify) {
        console.log(`[Claude] Verification enabled. Checking fact: "${questionMatch ? questionMatch[1].trim() : 'N/A'}" -> "${answerMatch ? answerMatch[1].trim() : 'N/A'}"`);
        const verification = await verifyFactWithSearch(questionMatch ? questionMatch[1].trim() : '', answerMatch ? answerMatch[1].trim() : '', model);
        if (!verification.verified) {
          console.warn('[Claude] Fact verification failed. Retrying question generation.');
          continue; // Skip this attempt and try again
        }
        console.log('[Claude] Fact verified successfully.');
      }

      if (!questionMatch || !answerMatch) {
        console.error('[Claude] Failed to parse trivia question response');
        return null;
      }

      const questionText = questionMatch[1].trim();
      let answer = answerMatch[1].trim();
      // Clean up answer - remove quotes, extra whitespace
      answer = answer.replace(/^[\"'\s]+|[\"'\s]+$/g, '');

      // Use the random label we picked earlier, since AI isn't generating one anymore
      const category = randomCategoryLabel;

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
        difficulty: 'medium' as const,
        source: 'claude' // Mark as AI-generated
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
