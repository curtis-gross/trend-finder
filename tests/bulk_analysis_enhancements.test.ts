import { expect, test, describe, vi, beforeEach } from 'vitest';
import { generateBulkAnalysis } from '../services/geminiService';

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
                  gemini_summary: ["Takeaway 1"],
                  summary: "Test summary",
                  trends: [],
                  recommendations: [],
                  datapoints: [],
                  early_signals: [],
                  search_findings: "...",
                  video_summaries: [],
                  competitive_landscape: "...",
                  critical_feedback: [],
                  positive_elements: [],
                  sentiment_table: {
                      positive: { feedback: [], insights: ["Insight 1"] },
                      negative: { feedback: [] },
                      neutral: { feedback: [] }
                  },
                  word_cloud: ["word1", "word2"]
                })
              }
            ]
          }
        }
      ]
    })
  });
});

describe('Bulk Analysis Enhancements Service', () => {
    test('generateBulkAnalysis returns new fields', async () => {
        const mockAnalyses = [{ type: 'abcd', result: {} }];
        
        const result = await generateBulkAnalysis(mockAnalyses, 'TestCompany');
        
        expect(result).toHaveProperty('sentiment_table');
        expect(result).toHaveProperty('word_cloud');
        expect(result.sentiment_table.positive.insights[0]).toBe('Insight 1');
    });
});
