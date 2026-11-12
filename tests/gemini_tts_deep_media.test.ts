import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generatePodcastTTS } from '../services/geminiService';

describe('Gemini 3.1 Flash TTS Deep Media Audio Synthesis', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('requests Gemini 3.1 Flash TTS with Aoede voice by default', async () => {
        const mockResponse = {
            success: true,
            audioUrl: '/audio/generated/daily_brief_test_123.wav',
            durationSeconds: 85,
            voiceName: 'Aoede',
            model: 'gemini-3.1-flash-tts-preview'
        };

        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockResponse
        });
        global.fetch = fetchSpy as any;

        const result = await generatePodcastTTS(
            'Good morning test-company leadership. Over the recent listening cycle...',
            'Aoede',
            'test-company'
        );

        expect(fetchSpy).toHaveBeenCalledWith(
            '/api/tts/generate-podcast',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: 'Good morning test-company leadership. Over the recent listening cycle...',
                    voiceName: 'Aoede',
                    companyName: 'test-company',
                    model: 'gemini-3.1-flash-tts-preview'
                })
            })
        );

        expect(result.audioUrl).toBe('/audio/generated/daily_brief_test_123.wav');
        expect(result.voiceName).toBe('Aoede');
        expect(result.model).toBe('gemini-3.1-flash-tts-preview');
        expect(result.durationSeconds).toBe(85);
    });

    it('supports executive voices (Aoede, Fenrir, Kore, Puck, Charon)', async () => {
        const executiveVoices = ['Aoede', 'Fenrir', 'Kore', 'Puck', 'Charon'];

        for (const voice of executiveVoices) {
            const fetchSpy = vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    success: true,
                    audioUrl: `/audio/generated/${voice}.wav`,
                    durationSeconds: 90,
                    voiceName: voice,
                    model: 'gemini-3.1-flash-tts-preview'
                })
            });
            global.fetch = fetchSpy as any;

            const res = await generatePodcastTTS('Test script', voice, 'test-company');
            expect(res.voiceName).toBe(voice);
            expect(res.audioUrl).toBe(`/audio/generated/${voice}.wav`);
        }
    });

    it('enforces Zero Silent Fallbacks when backend returns HTTP 500 error', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: 'Gemini 3.1 Flash TTS quota exhausted' })
        });
        global.fetch = fetchSpy as any;

        await expect(
            generatePodcastTTS('Test script', 'Aoede', 'test-company')
        ).rejects.toThrow(/Gemini 3.1 Flash TTS API error \(500\): Gemini 3.1 Flash TTS quota exhausted/);
    });

    it('enforces Zero Silent Fallbacks on network failure', async () => {
        const fetchSpy = vi.fn().mockRejectedValue(new Error('Connection refused'));
        global.fetch = fetchSpy as any;

        await expect(
            generatePodcastTTS('Test script', 'Aoede', 'test-company')
        ).rejects.toThrow('Connection refused');
    });

    it('throws explicit error when backend returns 200 but missing audioUrl', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: false, error: 'Synthesis produced no audio' })
        });
        global.fetch = fetchSpy as any;

        await expect(
            generatePodcastTTS('Test script', 'Aoede', 'test-company')
        ).rejects.toThrow('Synthesis produced no audio');
    });
});
