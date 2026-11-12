import { expect, test, describe, vi, beforeEach } from 'vitest';
import { analyzeCommentsSentiment } from '../services/geminiService';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
  mockFetch.mockResolvedValue({
    ok: true,
    headers: {
      get: (name: string) => name === 'content-type' ? 'application/json' : null
    },
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  counts: { positive: 1, negative: 0, neutral: 0 },
                  trends: { positive: [], negative: [], neutral: [] },
                  summary: "Test summary",
                  breakdown: [
                      { text: "Great video!", sentiment: "positive" }
                  ]
                })
              }
            ]
          }
        }
      ]
    })
  });
});

describe('Comments Sentiment Service', () => {
    test('analyzeCommentsSentiment returns breakdown', async () => {
        const mockComments = [{ author: 'User1', text: 'Great video!' }];
        
        const result = await analyzeCommentsSentiment(mockComments, 'TestCompany');
        
        expect(result).toHaveProperty('breakdown');
        expect(Array.isArray(result.breakdown)).toBe(true);
        expect(result.breakdown[0].sentiment).toBe('positive');
    });
});
