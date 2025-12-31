import Anthropic from '@anthropic-ai/sdk';

// Re-implement getClient locally to avoid circular deps or move to shared utils
function getClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set');
    }
    return new Anthropic({ apiKey });
}

interface SearchResult {
    title: string;
    content: string;
    url: string;
}

// Simple Tavily Search implementation
async function searchTavily(query: string, apiKey: string): Promise<SearchResult[]> {
    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: apiKey,
                query: query,
                search_depth: "basic",
                include_answer: false,
                max_results: 3
            })
        });

        if (!response.ok) {
            console.warn(`[Verification] Tavily search failed: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        console.log(`[Verification] Tavily found ${data.results?.length || 0} results for query: "${query}"`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = data.results.map((r: any) => ({
            title: r.title,
            content: r.content,
            url: r.url
        }));

        if (results.length > 0) {
            console.log(`[Verification] Top Result: "${results[0].title}" - ${results[0].content.slice(0, 100)}...`);
        }

        return results;
    } catch (error) {
        console.error('[Verification] Search error:', error);
        return [];
    }
}

export async function verifyFactWithSearch(
    questionText: string,
    answerText: string,
    model: string = 'claude-haiku-4-5-20251001'
): Promise<{ verified: boolean; reason: string }> {
    const apiKey = process.env.TAVILY_API_KEY || process.env.SEARCH_API_KEY;
    if (!apiKey) {
        console.warn('[Verification] No search API key found (TAVILY_API_KEY). Skipping verification.');
        return { verified: true, reason: 'Skipped (No API Key)' }; // Fail open to allow game to proceed
    }

    const factStatement = `Question: ${questionText}\nAnswer: ${answerText}`;
    console.log(`[Verification] Verifying: "${factStatement}"`);

    // 1. Search for context
    const searchResults = await searchTavily(factStatement, apiKey);
    if (searchResults.length === 0) {
        return { verified: true, reason: 'Skipped (No Search Results)' };
    }

    const contextString = searchResults.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n');
    console.log(`[Verification] Context for LLM (${contextString.length} chars):\n${contextString.slice(0, 200)}...`);

    // 2. Ask Claude to verify
    const client = getClient();
    try {
        const message = await client.messages.create({
            model: model, // Use selected model
            max_tokens: 200,
            temperature: 0,
            messages: [
                {
                    role: 'user',
                    content: `You are a Fact Checker for a trivia game.
Verify if the following TRIVIA FACT is supported by the SEARCH RESULTS.

TRIVIA FACT:
${factStatement}

SEARCH RESULTS:
${contextString}

INSTRUCTIONS:
- Determine if the "Answer" is effectively correct for the "Question" based on the results.
- Minor wording differences are fine (e.g. "USA" vs "United States").
- If the search results contradict the answer, reject it.
- If the search results are unrelated, lean towards rejecting (hallucination risk), unless it's common knowledge (but for Fibbage it shouldn't be).
- Respond with JSON: { "verified": boolean, "reason": "short explanation" }`
                }
            ]
        });

        const textBlock = message.content.find(block => block.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
            return { verified: true, reason: 'Verification Model Error' };
        }

        try {
            console.log(`[Verification] Raw LLM Response: ${textBlock.text}`);
            const result = JSON.parse(textBlock.text.trim());
            console.log(`[Verification] Parsed: Verified=${result.verified}, Reason="${result.reason}"`);
            return result;
        } catch {
            console.error('[Verification] Failed to parse JSON:', textBlock.text);
            // Fallback: check if text contains "true"
            const lower = textBlock.text.toLowerCase();
            const verified = lower.includes('true') && !lower.includes('false');
            return { verified, reason: 'JSON Parse Error' };
        }

    } catch (error) {
        console.error('[Verification] LLM check failed:', error);
        return { verified: true, reason: 'LLM Error' };
    }
}
