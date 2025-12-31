import Anthropic from '@anthropic-ai/sdk';

// Create Anthropic client with explicit API key (process.env doesn't work in PartyKit)
function getClient(apiKey: string): Anthropic {
    return new Anthropic({ apiKey });
}

interface SearchResult {
    title: string;
    content: string;
    url: string;
}

// Simple Tavily Search implementation with timeout
async function searchTavily(query: string, apiKey: string, logger?: (msg: string) => void): Promise<SearchResult[]> {
    const log = (msg: string) => {
        console.log(msg);
        if (logger) logger(msg);
    };

    try {
        // Add 5 second timeout to prevent hangs
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

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
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            log(`[Verification] ⚠️ Tavily search failed: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        log(`[Verification] Tavily found ${data.results?.length || 0} results`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = data.results.map((r: any) => ({
            title: r.title,
            content: r.content,
            url: r.url
        }));

        if (results.length > 0) {
            log(`[Verification] Top: "${results[0].title.slice(0, 50)}..."`);
        }

        return results;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            log(`[Verification] ⚠️ Tavily search TIMEOUT (5s)`);
        } else {
            log(`[Verification] ⚠️ Tavily error: ${error}`);
        }
        return [];
    }
}

export async function verifyFactWithSearch(
    questionText: string,
    answerText: string,
    tavilyApiKey?: string,
    anthropicApiKey?: string,
    model: string = 'claude-haiku-4-5-20251001',
    logger?: (msg: string) => void
): Promise<{ verified: boolean; reason: string }> {
    const log = (msg: string) => {
        console.log(msg);
        if (logger) logger(msg);
    };

    if (!tavilyApiKey) {
        log('[Verification] No Tavily API key. Skipping verification.');
        return { verified: true, reason: 'Skipped (No Tavily API Key)' };
    }

    if (!anthropicApiKey) {
        log('[Verification] No Anthropic API key. Skipping verification.');
        return { verified: true, reason: 'Skipped (No Anthropic API Key)' };
    }

    const factStatement = `Question: ${questionText}\nAnswer: ${answerText}`;
    log(`[Verification] Verifying: "${factStatement}"`);

    // 1. Search for context
    const searchResults = await searchTavily(factStatement, tavilyApiKey, logger);
    if (searchResults.length === 0) {
        log(`[Verification] No search results, skipping verification`);
        return { verified: true, reason: 'Skipped (No Search Results)' };
    }

    const contextString = searchResults.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n');
    log(`[Verification] Got ${searchResults.length} results, asking Claude to verify...`);

    // 2. Ask Claude to verify
    const client = getClient(anthropicApiKey);
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
