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

describe('Insights UI Adjustments', () => {
    test('Trend Intelligence modules import Trash2', () => {
        const content = readTrendIntelligenceSources();
        const importRegex = /import\s+{[^}]*Trash2[^}]*}\s+from\s+['"]lucide-react['"]/;
        expect(content).toMatch(importRegex);
    });

    test('Trend Intelligence modules use Trash2 in delete button', () => {
        const content = readTrendIntelligenceSources();
        expect(content).toContain('<Trash2 size={');
    });

    test('Trend Intelligence modules have row layout for type selector', () => {
        const content = readTrendIntelligenceSources();
        expect(content).toContain('flex flex-row items-center gap-2');
    });
});
