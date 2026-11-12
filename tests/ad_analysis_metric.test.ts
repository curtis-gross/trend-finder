import { expect, test, describe, vi, beforeEach } from 'vitest';
import { analyzeAdVideo } from '../services/geminiService';

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
                  first_mention: {
                      seconds: 3.5,
                      method: "logo shown",
                      result: "Pass"
                  },
                  abcd_scores: {
                      attract: { score: 8, observation: "..." },
                      brand: { score: 8, observation: "..." },
                      connect: { score: 8, observation: "..." },
                      direct: { score: 8, observation: "..." }
                  },
                  observations: [],
                  takeaways: [],
                  summary: "Test summary"
                })
              }
            ]
          }
        }
      ]
    })
  });
});

describe('Ad Analysis Metric', () => {
    test('analyzeAdVideo returns first_mention data', async () => {
        const result = await analyzeAdVideo('https://youtube.com/watch?v=123', 'TestCompany');
        
        expect(result).toHaveProperty('first_mention');
        expect(result.first_mention.seconds).toBe(3.5);
        expect(result.first_mention.result).toBe('Pass');
    });
});
