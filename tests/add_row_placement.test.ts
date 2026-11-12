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

describe('Add Row Placement', () => {
    test('Trend Intelligence listen table actions prepend new row', () => {
        const content = readTrendIntelligenceSources();
        expect(content).toMatch(/setRows\(\s*(?:\(\s*prev\s*\)\s*=>\s*)?\[\s*newRow\s*,\s*\.\.\.(?:rows|prev)\s*\]\s*\)/);
    });
});
