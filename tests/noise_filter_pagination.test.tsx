import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { NoiseFilter } from '../components/NoiseFilter';
import { ThemeProvider } from '../contexts/ThemeContext';

// Mock CompanyContext
vi.mock('../context/CompanyContext', () => ({
  useCompanyContext: () => ({
    companyName: 'test-company',
    brandName: 'test-company',
    name: 'test-company'
  })
}));

describe('NoiseFilter UI Viewport Expansion & Pagination Suite', () => {
  it('renders NoiseFilter in pipeline mode and mounts stage tab selectors', () => {
    render(
      <ThemeProvider>
        <NoiseFilter stageMode="pipeline" />
      </ThemeProvider>
    );

    expect(screen.getByText('1: Listen')).toBeDefined();
    expect(screen.getByText('2: Raw Ingest')).toBeDefined();
    expect(screen.getByText('3: Filter Noise')).toBeDefined();
    expect(screen.getByText('4: Topics')).toBeDefined();
  });

  it('can navigate to Stage 1 (Raw Ingest) tab', async () => {
    render(
      <ThemeProvider>
        <NoiseFilter stageMode="pipeline" initialStage="stage1" />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Raw Harvested Comments Corpus/i)).toBeDefined();
    });
  });

  it('can navigate to Stage 2 (Filter Noise) tab', async () => {
    render(
      <ThemeProvider>
        <NoiseFilter stageMode="pipeline" initialStage="stage2" />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Stage 2 Not Run Yet|Noise Reduction Telemetry/i)).toBeDefined();
    });
  });

  it('can navigate to Stage 3 (Topics) tab', async () => {
    render(
      <ThemeProvider>
        <NoiseFilter stageMode="pipeline" initialStage="stage3" />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Stage 3 Not Run Yet|Topic Taxonomy Telemetry/i)).toBeDefined();
    });
  });
});
