#!/usr/bin/env npx ts-node
/**
 * RAG Test Script
 * Tests Wikipedia API integration and answer validation
 * Run: npm run test:rag
 */

import { getWikipediaContext, getValidationContext } from './lib/wikipedia';
import { validatePlayerAnswer, validateAIAnswer } from './lib/validation';
import type { Question } from './lib/game-types';

const testQuestion: Question = {
    id: 'test-1',
    text: 'What color were carrots before the 17th century?',
    correctAnswer: 'Purple',
    category: 'History',
    difficulty: 'medium'
};

async function testWikipediaAPI() {
    console.log('\\n=== Testing Wikipedia API ===');

    const result = await getWikipediaContext('carrots history');
    if (result) {
        console.log('✅ Wikipedia API working');
        console.log('  Title:', result.title);
        console.log('  Extract:', result.extract.slice(0, 100) + '...');
        console.log('  Related terms:', result.relatedTerms.slice(0, 5));
    } else {
        console.log('⚠️  Wikipedia API returned null (may be rate limited)');
    }
}

async function testPlayerValidation() {
    console.log('\\n=== Testing Player Answer Validation ===');

    // Test 1: Should reject correct answer
    const result1 = await validatePlayerAnswer('Purple', testQuestion);
    console.log(`Test 1 - Submitting correct answer "Purple": ${result1.isValid ? '❌ FAIL' : '✅ PASS'} (${result1.reason})`);

    // Test 2: Should reject similar answer
    const result2 = await validatePlayerAnswer('purple colored', testQuestion);
    console.log(`Test 2 - Submitting similar "purple colored": ${result2.isValid ? '❌ FAIL' : '✅ PASS'} (${result2.reason})`);

    // Test 3: Should accept clearly wrong answer
    const result3 = await validatePlayerAnswer('Blue', testQuestion);
    console.log(`Test 3 - Submitting wrong answer "Blue": ${result3.isValid ? '✅ PASS' : '❌ FAIL'} (${result3.reason})`);

    // Test 4: Should accept creative fake
    const result4 = await validatePlayerAnswer('Fluorescent Green', testQuestion);
    console.log(`Test 4 - Submitting fake "Fluorescent Green": ${result4.isValid ? '✅ PASS' : '❌ FAIL'} (${result4.reason})`);
}

async function testAIValidation() {
    console.log('\\n=== Testing AI Answer Validation ===');

    // Test 1: Should reject if AI generates correct answer
    const result1 = await validateAIAnswer('Purple', testQuestion);
    console.log(`Test 1 - AI generates "Purple": ${result1.isValid ? '❌ FAIL' : '✅ PASS'} (${result1.reason})`);

    // Test 2: Should accept good fake
    const result2 = await validateAIAnswer('Orange', testQuestion);
    console.log(`Test 2 - AI generates "Orange": ${result2.isValid ? '✅ PASS' : '❌ FAIL'} (${result2.reason})`);
}

async function main() {
    console.log('🧪 Fibbage AI RAG Test Suite');
    console.log('============================');

    await testWikipediaAPI();
    await testPlayerValidation();
    await testAIValidation();

    console.log('\\n✅ Tests complete!');
}

main().catch(console.error);
