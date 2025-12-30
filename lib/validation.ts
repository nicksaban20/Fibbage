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
 * Uses fast fuzzy matching only - async API calls were causing 5+ second delays
 */
export async function validatePlayerAnswer(
    submittedAnswer: string,
    question: Question
): Promise<ValidationResult> {
    const answer = submittedAnswer.trim();
    const correctAnswer = question.correctAnswer;

    // Fast fuzzy string matching (catches typos/variations)
    if (isTooSimilarToCorrect(answer, correctAnswer, 0.2)) {
        return {
            isValid: false,
            reason: 'Your answer is too similar to the real answer!',
            confidence: 'high'
        };
    }

    // Also check case-insensitive exact match
    if (answer.toLowerCase() === correctAnswer.toLowerCase()) {
        return {
            isValid: false,
            reason: 'That\'s the correct answer! Try to make up a fake one.',
            confidence: 'high'
        };
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
