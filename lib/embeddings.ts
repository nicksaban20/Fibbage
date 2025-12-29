/**
 * Local embeddings for semantic similarity checking
 * Uses @xenova/transformers for browser/Node.js compatible embeddings
 */

// Dynamic import to avoid issues in environments where transformers isn't loaded
let pipeline: any = null;
let embeddingModel: any = null;

/**
 * Initialize the embedding model (lazy load)
 */
async function getEmbeddingModel() {
    if (embeddingModel) return embeddingModel;

    try {
        // Dynamic import of transformers
        const { pipeline: pipelineFn } = await import('@xenova/transformers');
        pipeline = pipelineFn;

        // Use a small, fast model suitable for sentence similarity
        embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            quantized: true // Use quantized model for faster inference
        });

        return embeddingModel;
    } catch (error) {
        console.error('Failed to load embedding model:', error);
        return null;
    }
}

/**
 * Compute embedding for a text string
 */
async function getEmbedding(text: string): Promise<number[] | null> {
    const model = await getEmbeddingModel();
    if (!model) return null;

    try {
        const output = await model(text, { pooling: 'mean', normalize: true });
        // Convert to regular array
        return Array.from(output.data);
    } catch (error) {
        console.error('Embedding error:', error);
        return null;
    }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Check if two answers are semantically similar
 * Returns similarity score between 0 (different) and 1 (identical)
 */
export async function getSemanticSimilarity(
    answer1: string,
    answer2: string
): Promise<number> {
    const [embedding1, embedding2] = await Promise.all([
        getEmbedding(answer1.toLowerCase().trim()),
        getEmbedding(answer2.toLowerCase().trim())
    ]);

    if (!embedding1 || !embedding2) {
        // Fallback to simple string comparison if embeddings fail
        return simpleStringSimilarity(answer1, answer2);
    }

    return cosineSimilarity(embedding1, embedding2);
}

/**
 * Check if an answer is semantically too similar to another
 */
export async function isSemanticallySimilar(
    answer1: string,
    answer2: string,
    threshold: number = 0.85
): Promise<boolean> {
    const similarity = await getSemanticSimilarity(answer1, answer2);
    return similarity >= threshold;
}

/**
 * Simple string similarity fallback (Jaccard-like)
 * Used when embeddings aren't available
 */
function simpleStringSimilarity(a: string, b: string): number {
    const wordsA = a.toLowerCase().split(/\s+/);
    const wordsB = b.toLowerCase().split(/\s+/);
    const setB = new Set(wordsB);

    let intersection = 0;
    for (const word of wordsA) {
        if (setB.has(word)) intersection++;
    }

    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Check if embedding model is available
 * Useful for feature detection
 */
export async function isEmbeddingModelAvailable(): Promise<boolean> {
    try {
        const model = await getEmbeddingModel();
        return model !== null;
    } catch {
        return false;
    }
}
