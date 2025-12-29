/**
 * Wikipedia API integration for RAG context retrieval
 * Fetches real-world facts to help Claude generate plausible fake answers
 * and validate player submissions
 */

export interface WikiFact {
  title: string;
  extract: string;
  relatedTerms: string[];
}

export interface ValidationContext {
  facts: string[];
  relatedAnswers: string[];
  source: 'wikipedia' | 'fallback';
}

// Simple in-memory cache to avoid repeated API calls
const cache = new Map<string, { data: WikiFact | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Extract search terms from a question
 * Removes common question words and articles
 */
function extractSearchTerms(question: string): string {
  const stopWords = new Set([
    'what', 'which', 'who', 'whom', 'where', 'when', 'why', 'how',
    'is', 'are', 'was', 'were', 'the', 'a', 'an', 'of', 'for', 'to',
    'in', 'on', 'at', 'by', 'with', 'about', 'that', 'this', 'it',
    'its', 'does', 'did', 'do', 'has', 'have', 'had', 'be', 'been',
    'being', 'called', 'known', 'named'
  ]);

  return question
    .toLowerCase()
    .replace(/[?.,!'"]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 5) // Limit to 5 key terms
    .join(' ');
}

/**
 * Fetch Wikipedia summary for a topic
 */
export async function getWikipediaContext(query: string): Promise<WikiFact | null> {
  // Check cache first
  const cacheKey = query.toLowerCase().trim();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Use Wikipedia REST API for summary
    const searchTerm = encodeURIComponent(query.replace(/\s+/g, '_'));
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${searchTerm}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FibbageAI/1.0 (Educational trivia game)'
        }
      }
    );

    if (!response.ok) {
      // Try search API as fallback
      return await searchWikipedia(query);
    }

    const data = await response.json();

    const fact: WikiFact = {
      title: data.title || query,
      extract: data.extract || '',
      relatedTerms: extractRelatedTerms(data.extract || '')
    };

    // Cache the result
    cache.set(cacheKey, { data: fact, timestamp: Date.now() });

    return fact;
  } catch (error) {
    console.error('Wikipedia API error:', error);
    cache.set(cacheKey, { data: null, timestamp: Date.now() });
    return null;
  }
}

/**
 * Search Wikipedia when direct lookup fails
 */
async function searchWikipedia(query: string): Promise<WikiFact | null> {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FibbageAI/1.0 (Educational trivia game)'
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const results = data.query?.search;

    if (!results || results.length === 0) return null;

    // Get the first result's summary
    const topResult = results[0].title;
    return getWikipediaContext(topResult);
  } catch {
    return null;
  }
}

/**
 * Extract potential answer-like terms from text
 */
function extractRelatedTerms(text: string): string[] {
  // Extract capitalized phrases (likely proper nouns/names)
  const capitalizedPattern = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g;
  const matches = text.match(capitalizedPattern) || [];

  // Also extract numbers and years
  const numberPattern = /\b\d{1,4}(?:\s*(?:AD|BC|CE|BCE))?\b/g;
  const numbers = text.match(numberPattern) || [];

  // Combine and dedupe using array filter
  const combined = [...matches, ...numbers];
  const terms = combined.filter((item, index) => combined.indexOf(item) === index);

  return terms.slice(0, 10); // Limit to 10 terms
}

/**
 * Get validation context for a question
 * Used to check if player answers are too close to real facts
 */
export async function getValidationContext(
  question: string,
  category: string,
  correctAnswer: string
): Promise<ValidationContext> {
  const searchTerms = extractSearchTerms(question);
  const wikiFact = await getWikipediaContext(searchTerms);

  if (wikiFact && wikiFact.extract) {
    // Extract key facts from Wikipedia
    const facts = wikiFact.extract
      .split(/[.!?]/)
      .filter(s => s.trim().length > 10)
      .slice(0, 5);

    return {
      facts,
      relatedAnswers: [correctAnswer, ...wikiFact.relatedTerms],
      source: 'wikipedia'
    };
  }

  // Fallback to basic context
  return {
    facts: [],
    relatedAnswers: [correctAnswer],
    source: 'fallback'
  };
}

/**
 * Build RAG context string for Claude prompt
 */
export function buildRAGPromptContext(
  wikiFact: WikiFact | null,
  correctAnswer: string
): string {
  if (!wikiFact || !wikiFact.extract) {
    return `The correct answer is: "${correctAnswer}"\nGenerate a plausible but INCORRECT answer.`;
  }

  return `
CONTEXT FROM WIKIPEDIA:
${wikiFact.extract.slice(0, 500)}

KNOWN FACTS TO AVOID (these are real - do NOT generate answers similar to these):
- Correct answer: "${correctAnswer}"
${wikiFact.relatedTerms.slice(0, 5).map(t => `- ${t}`).join('\n')}

Generate a fake answer that sounds plausible but is definitively WRONG and different from all the above facts.
`.trim();
}
