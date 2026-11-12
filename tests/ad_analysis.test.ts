import { expect, test, describe, vi, beforeEach } from 'vitest';
import { analyzeAdVideo, generateCompetitiveAnalysis } from '../services/geminiService';

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
                  abcd_scores: {
                    attract: { score: 8.5, observation: "Great hook" },
                    brand: { score: 9.0, observation: "Clear logo" },
                    connect: { score: 7.5, observation: "Emotional" },
                    direct: { score: 8.0, observation: "Clear CTA" }
                  },
                  observations: [
                    { category: "Visuals", notes: "Bright colors" }
                  ],
                  takeaways: ["Takeaway 1"],
                  summary: "Summary text",
                  timestamp: "2026-04-02"
                })
              }
            ]
          }
        }
      ]
    })
  });
});

describe('Video Ad Analysis', () => {
    test('analyzeAdVideo returns valid ABCD scoring data', async () => {
        const result = await analyzeAdVideo("https://www.youtube.com/watch?v=QVhwdWr1i-Y");

        expect(result).toBeDefined();
        expect(result.abcd_scores).toBeDefined();
        expect(result.abcd_scores.attract.score).toBe(8.5);
        expect(result.abcd_scores.brand.score).toBe(9.0);
        expect(result.observations).toHaveLength(1);
        expect(result.summary).toBe("Summary text");
    });

    test('generateCompetitiveAnalysis returns valid comparison data', async () => {
        const ad1Data = {
            abcd_scores: { attract: { score: 8 }, brand: { score: 9 }, connect: { score: 7 }, direct: { score: 8 } }
        };
        const ad2Data = {
            abcd_scores: { attract: { score: 7 }, brand: { score: 8 }, connect: { score: 8 }, direct: { score: 7 } }
        };
        
        mockFetch.mockResolvedValueOnce({
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
                                        winner: "Ad 1",
                                        scoring_comparison: "Ad 1 beats Ad 2 in branding",
                                        strengths_weaknesses: { ad1: "strong", ad2: "weak" },
                                        tips: ["Tip 1"]
                                    })
                                }
                            ]
                        }
                    }
                ]
            })
        });

        const result = await generateCompetitiveAnalysis(ad1Data, ad2Data, "test-company");

        expect(result).toBeDefined();
        expect(result.winner).toBe("Ad 1");
        expect(result.tips).toContain("Tip 1");
    });
});
