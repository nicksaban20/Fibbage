/**
 * Enhanced answer validation with RAG support
 * Combines fuzzy matching, semantic similarity, and Wikipedia fact-checking
 */

import type { Question } from './game-types';
import { isTooSimilarToCorrect } from './fuzzy-match';
import { isSemanticallySimilar } from './embeddings';
import { getValidationContext } from './wikipedia';

export interface ValidationResult {
    isValid: boolean;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Validate a player's submitted answer
 * Checks multiple layers to prevent submitting the correct answer
 */
export async function validatePlayerAnswer(
    submittedAnswer: string,
    question: Question
): Promise<ValidationResult> {
    const answer = submittedAnswer.trim();
    const correctAnswer = question.correctAnswer;

    // Layer 1: Fuzzy string matching (fast, catches typos/variations)
    if (isTooSimilarToCorrect(answer, correctAnswer, 0.2)) {
        return {
            isValid: false,
            reason: 'Your answer is too similar to the real answer!',
            confidence: 'high'
        };
    }

    // Layer 2: Semantic similarity (catches synonyms/paraphrases)
    try {
        const isSemanticallyClose = await isSemanticallySimilar(
            answer,
            correctAnswer,
            0.85 // High threshold to avoid false positives
        );

        if (isSemanticallyClose) {
            return {
                isValid: false,
                reason: 'Your answer means the same thing as the real answer!',
                confidence: 'high'
            };
        }
    } catch (error) {
        // Embedding check failed, continue with other validations
        console.warn('Semantic similarity check failed:', error);
    }

    // Layer 3: Wikipedia fact check (catches factually correct alternatives)
    try {
        const context = await getValidationContext(
            question.text,
            question.category,
            correctAnswer
        );

        // Check if the answer matches any known related facts
        for (const relatedAnswer of context.relatedAnswers) {
            if (isTooSimilarToCorrect(answer, relatedAnswer, 0.3)) {
                return {
                    isValid: false,
                    reason: 'Your answer is too close to a known fact about this topic!',
                    confidence: 'medium'
                };
            }
        }
    } catch (error) {
        // Wikipedia check failed, not critical
        console.warn('Wikipedia validation failed:', error);
    }

    // All checks passed
    return {
        isValid: true,
        reason: 'Answer accepted',
        confidence: 'high'
    };
}

/**
 * Validate AI-generated fake answer
 * Ensures Claude's answer is actually wrong
 * Note: Simplified to skip embedding model which doesn't work in PartyKit workerd runtime
 */
export function validateAIAnswer(
    aiAnswer: string,
    question: Question
): ValidationResult {
    const correctAnswer = question.correctAnswer;

    // Check fuzzy match only (embedding model doesn't work in workerd)
    if (isTooSimilarToCorrect(aiAnswer, correctAnswer, 0.25)) {
        return {
            isValid: false,
            reason: 'AI answer too similar to correct answer',
            confidence: 'high'
        };
    }

    // Check if the AI answer is too short or generic
    if (aiAnswer.length < 2 || aiAnswer.toLowerCase() === 'unknown') {
        return {
            isValid: false,
            reason: 'AI answer too generic',
            confidence: 'high'
        };
    }

    return {
        isValid: true,
        reason: 'AI answer validated',
        confidence: 'high'
    };
}
