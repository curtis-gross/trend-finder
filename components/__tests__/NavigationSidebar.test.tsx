/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navigation } from '../Navigation';
import { ThemeProvider } from '../../contexts/ThemeContext';
import React from 'react';
import { AppMode } from '../../types';

// Mock Lucide icons
vi.mock('lucide-react', () => {
  const DummyIcon = (props: any) => <div {...props} />;
  return {
    Search: DummyIcon,
    ChevronRight: (props: any) => <div data-testid="chevron-right" {...props} />,
    PanelLeftClose: DummyIcon,
    PanelLeftOpen: DummyIcon,
    Folder: DummyIcon,
    TrendingUp: DummyIcon,
    Sparkles: DummyIcon,
    FileText: DummyIcon,
    Radar: DummyIcon,
    Filter: DummyIcon,
    Sun: DummyIcon,
    Moon: DummyIcon
  };
});

// Mock CompanyContext
const mockUseCompanyContext = vi.fn(() => ({
  name: 'test-company'
}));
vi.mock('../../context/CompanyContext', () => ({
  useCompanyContext: () => mockUseCompanyContext()
}));

// Mock AppConfigContext
const mockUseAppConfig = vi.fn(() => ({
  config: null
}));
vi.mock('../../context/AppConfigContext', () => ({
  useAppConfig: () => mockUseAppConfig()
}));

// Mock brandConfig
vi.mock('../../config', () => ({
  brandConfig: {
    companyName: 'test-company',
    workspaceName: 'test-company',
    colors: {
      accent: '#0072BC'
    },
    logo: {
      sidebar: ''
    }
  }
}));

describe('Navigation Sidebar Workflows & Collapsible Shell', () => {
  const mockSetMode = vi.fn();
  const mockSetIsMobileMenuOpen = vi.fn();

  beforeEach(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('dark', 'light');
    mockUseCompanyContext.mockReturnValue({ name: 'test-company' });
    mockUseAppConfig.mockReturnValue({ config: null });
    vi.clearAllMocks();
  });

  it('renders text-based TEST-COMPANY studio sans wordmark in upper-left even when a logo URL is present', () => {
    mockUseCompanyContext.mockReturnValue({ name: 'test-company' });
    mockUseAppConfig.mockReturnValue({
      config: {
        branding: {
          logo: '/images/custom-logo.png',
          companyName: 'test-company',
          colors: { accent: '#0072BC' }
        }
      } as any
    });

    render(
      <ThemeProvider>
        <Navigation
          currentMode={AppMode.INSIGHTS}
          setMode={mockSetMode}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </ThemeProvider>
    );

    expect(screen.queryAllByRole('img').length).toBe(0);
    const wordmark = screen.getByText('TEST-COMPANY');
    expect(wordmark).toBeDefined();
    expect(wordmark.className).toContain('app-wordmark');
    expect(wordmark.className).toContain('font-studio-sans');
    expect(wordmark.className).toContain('text-white');
    expect((wordmark as HTMLElement).style.fontFamily).toContain('Inter');
  });

  it('renders Trend Intelligence and Filter Pipeline workflow items under Workflows and omits removed sections', () => {
    const { container } = render(
      <Navigation
        currentMode={AppMode.INSIGHTS}
        setMode={mockSetMode}
        isMobileMenuOpen={false}
        setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
      />
    );

    expect(screen.getByText('Workflows')).toBeDefined();
    expect(screen.getByText('Trend Intelligence')).toBeDefined();
    expect(screen.getByText('Filter Pipeline')).toBeDefined();

    const workflowsHeader = screen.getByText('Workflows').closest('button');
    expect(workflowsHeader?.textContent).toContain('2');

    // Removed legacy sections must not appear
    expect(screen.queryByText('Homepage')).toBeNull();
    expect(screen.queryByText('History')).toBeNull();
    expect(screen.queryByText('Other')).toBeNull();
    expect(screen.queryByTitle('Admin Configuration')).toBeNull();

    // Only one ChevronRight for the Workflows collapsible header
    const chevrons = container.querySelectorAll('[data-testid="chevron-right"]');
    expect(chevrons.length).toBe(1);
    const workflowItemBtn = screen.getByText('Trend Intelligence').closest('button');
    expect(workflowItemBtn?.querySelector('[data-testid="chevron-right"]')).toBeNull();
  });

  it('routes cleanly to AppMode.INSIGHTS and AppMode.FILTER_PIPELINE when workflow items or wordmark are clicked', () => {
    const setModeSpy = vi.fn();
    render(
      <Navigation
        currentMode={AppMode.INSIGHTS}
        setMode={setModeSpy}
        isMobileMenuOpen={false}
        setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
      />
    );

    screen.getByText('Trend Intelligence').closest('button')?.click();
    expect(setModeSpy).toHaveBeenCalledWith(AppMode.INSIGHTS);

    setModeSpy.mockClear();
    screen.getByText('Filter Pipeline').closest('button')?.click();
    expect(setModeSpy).toHaveBeenCalledWith(AppMode.FILTER_PIPELINE);

    setModeSpy.mockClear();
    screen.getByText('TEST-COMPANY').closest('div')?.click();
    expect(setModeSpy).toHaveBeenCalledWith(AppMode.INSIGHTS);
  });

  it('displays TC monogram, floating Sidebar button, and tooltips when sidebar is collapsed', () => {
    const toggleCollapseSpy = vi.fn();
    render(
      <Navigation
        currentMode={AppMode.INSIGHTS}
        setMode={mockSetMode}
        isMobileMenuOpen={false}
        setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        isCollapsed={true}
        onToggleCollapse={toggleCollapseSpy}
      />
    );

    expect(screen.getByText('TC')).toBeDefined();
    expect(screen.getByText('Sidebar')).toBeDefined();
    expect(screen.getAllByTitle('Trend Intelligence').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTitle('test-company')).toBeDefined();

    fireEvent.click(screen.getByText('Sidebar').closest('button')!);
    expect(toggleCollapseSpy).toHaveBeenCalledTimes(1);
  });

  it('filters workflow items via search input and collapses/expands Workflows section', () => {
    render(
      <Navigation
        currentMode={AppMode.INSIGHTS}
        setMode={mockSetMode}
        isMobileMenuOpen={false}
        setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search workflows') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Trend' } });
    expect(screen.getByText('Trend Intelligence')).toBeDefined();

    fireEvent.change(searchInput, { target: { value: 'NonExistentWorkflowXYZ' } });
    expect(screen.queryByText('Trend Intelligence')).toBeNull();

    fireEvent.change(searchInput, { target: { value: '' } });
    const workflowsHeader = screen.getByText('Workflows').closest('button')!;
    fireEvent.click(workflowsHeader);
    expect(screen.queryByText('Trend Intelligence')).toBeNull();

    fireEvent.click(workflowsHeader);
    expect(screen.getByText('Trend Intelligence')).toBeDefined();
  });

  it('routes to AppMode.FILTER_PIPELINE and highlights only the active Sidebar item', () => {
    const setModeSpy = vi.fn();
    const { rerender } = render(
      <Navigation
        currentMode={AppMode.INSIGHTS}
        setMode={setModeSpy}
        isMobileMenuOpen={false}
        setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
      />
    );

    const trendBtn = () => screen.getByText('Trend Intelligence').closest('button')!;
    const pipelineBtn = () => screen.getByText('Filter Pipeline').closest('button')!;
    expect(trendBtn().className).toContain('border-l-4');
    expect(pipelineBtn().className).not.toContain('border-l-4');

    fireEvent.click(pipelineBtn());
    expect(setModeSpy).toHaveBeenCalledWith(AppMode.FILTER_PIPELINE);

    rerender(
      <Navigation
        currentMode={AppMode.FILTER_PIPELINE}
        setMode={setModeSpy}
        isMobileMenuOpen={false}
        setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
      />
    );
    expect(pipelineBtn().className).toContain('border-l-4');
    expect(trendBtn().className).not.toContain('border-l-4');
  });
});
