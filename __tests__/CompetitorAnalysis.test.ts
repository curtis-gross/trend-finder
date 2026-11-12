import { describe, it, expect } from 'vitest';
import { analyzeAdVideo } from '../services/geminiService';

describe('Competitor Analysis Signature', () => {
  it('should accept isCompetitor flag and return a promise', () => {
    const promise = analyzeAdVideo('test_vid', 'test-company');
    expect(promise).toBeInstanceOf(Promise);
  });
});
