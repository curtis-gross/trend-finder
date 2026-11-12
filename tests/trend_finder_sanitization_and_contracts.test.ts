import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { brandConfig } from '../config';
import { getDefaultListenTableRows } from '../services/noiseFilterService';
import { DEFAULT_FEATURE_CLUSTERS } from '../hooks/useTaxonomyMetrics';
import {
  DEFAULT_FEATURE_CLUSTERS as HOME_DEFAULT_CLUSTERS,
  DEFAULT_INITIAL_TOP_TOPICS,
  DEFAULT_INITIAL_RISING_TOPICS
} from '../components/InsightsHome';

const ROOT_DIR = path.resolve(__dirname, '..');

function collectTrackedSourceFiles(dirPath: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return acc;
  const stat = fs.statSync(dirPath);
  if (stat.isFile()) {
    acc.push(dirPath);
    return acc;
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name.startsWith('.') ||
      entry.name === 'node_modules' ||
      entry.name === '__pycache__' ||
      entry.name === 'dist' ||
      entry.name === 'build'
    ) {
      continue;
    }
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectTrackedSourceFiles(full, acc);
    } else if (/\.(ts|tsx|js|py|css|html|json|sh|md|example)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const SELF_SANITIZER_FILES = new Set([
  'tests/trend_finder_sanitization_and_contracts.test.ts',
  'tests/test_client_setup_and_privacy.py',
  'scripts/audit_privacy.sh',
  'scripts/gcp_preflight.sh',
  'scripts/setup_assistant.py'
]);

function isRegexOrPatternDefinitionLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('*')) {
    return true;
  }
  return /(?:RegExp|re\.compile|grep\b|sed\b|awk\b|PATTERN|REGEX|\.join\()/i.test(trimmed);
}

function collectSanitizationTargetFiles(): string[] {
  const targets = [
    path.join(ROOT_DIR, 'components'),
    path.join(ROOT_DIR, 'services'),
    path.join(ROOT_DIR, 'backend'),
    path.join(ROOT_DIR, 'styles'),
    path.join(ROOT_DIR, 'scripts'),
    path.join(ROOT_DIR, 'tests'),
    path.join(ROOT_DIR, '__tests__'),
    path.join(ROOT_DIR, 'config.ts'),
    path.join(ROOT_DIR, 'config'),
    path.join(ROOT_DIR, 'index.html'),
    path.join(ROOT_DIR, 'vite.config.ts'),
    path.join(ROOT_DIR, 'start_local.sh'),
    path.join(ROOT_DIR, 'cloud_run.sh'),
    path.join(ROOT_DIR, 'gcp_setup_deploy.sh'),
    path.join(ROOT_DIR, 'README.md'),
    path.join(ROOT_DIR, '.env.example'),
    path.join(ROOT_DIR, '.vscode', 'settings.json'),
    path.join(ROOT_DIR, 'public', 'data', 'configuration', 'app_config.json')
  ];
  return Array.from(new Set(targets.flatMap(t => collectTrackedSourceFiles(t))));
}

describe('Trend Finder Sanitization & Core Contracts', () => {
  it('configures app_config.json and config.ts for test-company with INSIGHTS and FILTER_PIPELINE navigation items', () => {
    const appConfigPath = path.join(ROOT_DIR, 'public', 'data', 'configuration', 'app_config.json');
    const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));

    expect(appConfig.branding.companyName).toBe('test-company');
    expect(appConfig.branding.workspaceName).toBe('test-company');
    expect(appConfig.branding.metaTitle).toBe('test-company | Trend Intelligence');
    expect(appConfig.defaultMode).toBe('INSIGHTS');
    expect(Array.isArray(appConfig.navigation)).toBe(true);
    expect(appConfig.navigation).toHaveLength(2);
    expect(appConfig.navigation[0]).toMatchObject({
      id: 'INSIGHTS',
      label: 'Trend Intelligence',
      visible: true
    });
    expect(appConfig.navigation[1]).toMatchObject({
      id: 'FILTER_PIPELINE',
      label: 'Filter Pipeline',
      visible: true
    });

    expect(brandConfig.companyName).toBe('test-company');
    expect(brandConfig.workspaceName).toBe('test-company');
  });

  it('returns empty cold-start arrays for getDefaultListenTableRows and DEFAULT_FEATURE_CLUSTERS', () => {
    expect(getDefaultListenTableRows('test-company')).toEqual([]);
    expect(getDefaultListenTableRows()).toEqual([]);
    expect(DEFAULT_FEATURE_CLUSTERS).toEqual([]);
    expect(HOME_DEFAULT_CLUSTERS).toEqual([]);
    expect(DEFAULT_INITIAL_TOP_TOPICS).toEqual([]);
    expect(DEFAULT_INITIAL_RISING_TOPICS).toEqual([]);
  });

  it('enforces zero hardcoded secrets, workstation paths, internal jargon, or dead config across tracked files', () => {
    const strictSecretRules: Array<{ name: string; regex: RegExp }> = [
      {
        name: 'hardcoded Google API key',
        regex: new RegExp(['AI', 'za', '[0-9A-Za-z_-]{35}'].join(''))
      },
      {
        name: 'OAuth access token',
        regex: new RegExp(['ya', '29\\.', '[0-9A-Za-z_-]{20,}'].join(''))
      },
      {
        name: 'Google OAuth client secret',
        regex: new RegExp(['GOC', 'SPX-', '[0-9A-Za-z_-]{10,}'].join(''))
      },
      {
        name: 'PEM private key block',
        regex: new RegExp(['-----BEGIN (?:[A-Z0-9 ]+ )?PRI', 'VATE KEY-----'].join(''))
      }
    ];

    const sanitizationRules: Array<{ name: string; regex: RegExp }> = [
      {
        name: 'hardcoded workstation home path',
        regex: new RegExp(['/(?:Us', 'ers|ho', 'me)/[A-Za-z0-9._-]+'].join(''))
      },
      {
        name: 'hardcoded workstation git path',
        regex: new RegExp(['/usr/lo', 'cal/git/cur', 'rent'].join(''))
      },
      {
        name: 'corporate google.com email',
        regex: new RegExp(['[A-Za-z0-9._%+-]+@goo', 'gle\\.com\\b'].join(''), 'i')
      },
      {
        name: 'internal sandbox jargon',
        regex: new RegExp(['\\b[A]rgo', 'lis\\b'].join(''), 'i')
      },
      {
        name: 'internal studio getcode header',
        regex: new RegExp(['vertex-agent-studio-', 'getcode'].join(''), 'i')
      },
      {
        name: 'dummy fallback secret',
        regex: new RegExp(['VERTEX_AI_', 'FALLBACK'].join(''))
      }
    ];

    const files = collectSanitizationTargetFiles();
    expect(files.length).toBeGreaterThan(10);

    const violations: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');

      for (const rule of strictSecretRules) {
        const match = content.match(rule.regex);
        if (match) {
          violations.push(`${rel} (${rule.name}): matched "${match[0]}"`);
        }
      }

      const lines = content.split(/\r?\n/);
      const isSelfSanitizer = SELF_SANITIZER_FILES.has(rel);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (isSelfSanitizer && isRegexOrPatternDefinitionLine(line)) {
          continue;
        }
        for (const rule of sanitizationRules) {
          const match = line.match(rule.regex);
          if (match) {
            violations.push(`${rel}:${i + 1} (${rule.name}): matched "${match[0]}"`);
          }
        }
      }
    }

    const deadMapsKeyPattern = new RegExp(['GOOGLE_MAPS_', 'API_KEY'].join(''));
    for (const relTarget of ['.env.example', 'cloud_run.sh']) {
      const targetPath = path.join(ROOT_DIR, relTarget);
      if (fs.existsSync(targetPath)) {
        const text = fs.readFileSync(targetPath, 'utf8');
        if (deadMapsKeyPattern.test(text)) {
          violations.push(`${relTarget}: contains dead GOOGLE_MAPS_API_KEY config`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('verifies vite.config.ts does not inject GEMINI_API_KEY in define', () => {
    const viteConfigPath = path.join(ROOT_DIR, 'vite.config.ts');
    const viteContent = fs.readFileSync(viteConfigPath, 'utf8');

    expect(viteContent).not.toMatch(/process\.env\.GEMINI_API_KEY/);
    expect(viteContent).not.toMatch(/define\s*:\s*\{[^}]*GEMINI_API_KEY/s);
  });
});
