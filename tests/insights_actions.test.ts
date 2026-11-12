import { expect, test, describe } from 'vitest';
import fs from 'fs';
import path from 'path';

function readTrendIntelligenceSources(): string {
    const rootFile = path.join(__dirname, '../components/RunwayAnalysis.tsx');
    const dirPath = path.join(__dirname, '../components/trendIntelligence');
    const chunks: string[] = [];

    if (fs.existsSync(rootFile)) {
        chunks.push(fs.readFileSync(rootFile, 'utf8'));
    }

    function walk(dir: string) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (/\.(ts|tsx)$/.test(entry.name)) {
                chunks.push(fs.readFileSync(full, 'utf8'));
            }
        }
    }

    walk(dirPath);
    return chunks.join('\n');
}

describe('Insights Actions Adjustments', () => {
    test('Trend Intelligence modules import RotateCw', () => {
        const content = readTrendIntelligenceSources();
        const importRegex = /import\s+{[^}]*RotateCw[^}]*}\s+from\s+['"]lucide-react['"]/;
        expect(content).toMatch(importRegex);
    });

    test('Trend Intelligence modules use RotateCw in re-analyze button', () => {
        const content = readTrendIntelligenceSources();
        expect(content).toContain('<RotateCw size={');
    });

    test('Trend Intelligence modules use Eye in view button', () => {
        const content = readTrendIntelligenceSources();
        expect(content).toContain('<Eye size={');
    });

    test('Trend Intelligence modules have row layout for actions', () => {
        const content = readTrendIntelligenceSources();
        expect(content).toContain('flex flex-row items-center gap-1 mx-auto w-fit');
    });
});
