import { expect, test, describe } from 'vitest';
import { brandConfig } from '../config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Brand & Wordmark Configuration', () => {
  test('brandConfig is configured for test-company branding', () => {
    expect(brandConfig.companyName).toBe('test-company');
    expect(brandConfig.workspaceName).toBe('test-company');
    expect(brandConfig.colors.primary).toBe('#0F172A');
    expect(brandConfig.colors.accent).toBe('#0072BC');
  });

  test('index.html defines inline SVG monogram favicon', () => {
    const indexPath = path.resolve(__dirname, '../index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    expect(indexHtml).toContain('rel="icon"');
    expect(indexHtml).toContain('image/svg+xml');
  });
});
