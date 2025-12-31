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
            model: model,
            max_tokens: 150,
            temperature: 0,
            messages: [
                {
                    role: 'user',
                    content: `You are a fact checker for a trivia game. Is this fact accurate?

FACT: "${questionText.replace('_____', answerText)}"

SEARCH RESULTS:
${contextString}

RULES:
- If the search results SUPPORT or DON'T CONTRADICT the fact, reply: {"verified":true,"reason":"brief explanation"}
- If the search results CONTRADICT the fact, reply: {"verified":false,"reason":"brief explanation"}
- If unsure but fact seems plausible, lean towards verified=true (the game should proceed)
- ONLY output valid JSON, nothing else`
                }
            ]
        });

        const textBlock = message.content.find(block => block.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
            return { verified: true, reason: 'Verification Model Error' };
        }

        // Try to extract JSON from response (handle markdown code blocks etc)
        let responseText = textBlock.text.trim();

        // Remove markdown code blocks if present
        responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
        responseText = responseText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');

        try {
            const result = JSON.parse(responseText);
            log(`[Verification] ${result.verified ? '✅' : '❌'} ${result.reason}`);
            return result;
        } catch {
            // Fallback: look for verified patterns in text
            const lower = responseText.toLowerCase();
            const hasTrue = lower.includes('"verified":true') || lower.includes('"verified": true');
            const hasFalse = lower.includes('"verified":false') || lower.includes('"verified": false');

            if (hasTrue && !hasFalse) {
                log(`[Verification] ✅ (parsed from text)`);
                return { verified: true, reason: 'Parsed from non-JSON response' };
            } else if (hasFalse) {
                // Extract reason if possible
                const reasonMatch = responseText.match(/"reason"\s*:\s*"([^"]+)"/);
                const reason = reasonMatch ? reasonMatch[1] : 'Failed verification';
                log(`[Verification] ❌ ${reason}`);
                return { verified: false, reason };
            }

            // Default to verified if we can't parse (game should proceed)
            log(`[Verification] ⚠️ Could not parse response, allowing question`);
            return { verified: true, reason: 'Parse error (allowed by default)' };
        }

    } catch (error) {
        log(`[Verification] ⚠️ Error: ${error}`);
        return { verified: true, reason: 'LLM Error' };
    }
}
