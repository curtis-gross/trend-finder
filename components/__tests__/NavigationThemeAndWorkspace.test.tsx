/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navigation } from '../Navigation';
import { ThemeProvider, THEME_STORAGE_KEY } from '../../contexts/ThemeContext';
import React from 'react';
import { AppMode } from '../../types';

// Mock Lucide icons
vi.mock('lucide-react', () => {
  const DummyIcon = (props: any) => <div {...props} />;
  return {
    Search: DummyIcon,
    ChevronRight: DummyIcon,
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

describe('Navigation Theme Toggle, --app-* Tokens & Workspace Controls', () => {
  const mockSetMode = vi.fn();
  const mockSetIsMobileMenuOpen = vi.fn();
  let storageStore: Record<string, string> = {};

  beforeEach(() => {
    storageStore = {};
    const mockLocalStorage = {
      getItem: (key: string) => (key in storageStore ? storageStore[key] : null),
      setItem: (key: string, val: string) => {
        storageStore[key] = String(val);
      },
      removeItem: (key: string) => {
        delete storageStore[key];
      },
      clear: () => {
        storageStore = {};
      }
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
      writable: true
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
      writable: true
    });

    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('dark', 'light');
    mockUseCompanyContext.mockReturnValue({ name: 'test-company' });
    mockUseAppConfig.mockReturnValue({ config: null });
    vi.clearAllMocks();
  });

  it('uses app-theme-v1 storage key and toggles wordmark color to #041E3A in light mode', () => {
    expect(THEME_STORAGE_KEY).toBe('app-theme-v1');

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

    expect(window.localStorage.getItem('app-theme-v1')).toBe('dark');

    // Switch from default Dark Mode to Light Mode
    fireEvent.click(screen.getByLabelText('Toggle theme'));

    expect(window.localStorage.getItem('app-theme-v1')).toBe('light');
    const wordmark = screen.getByText('TEST-COMPANY');
    expect(wordmark).toBeDefined();
    expect(wordmark.className).toContain('app-wordmark');
    expect(wordmark.className).toContain('font-studio-sans');
    expect(wordmark.className).toContain('text-[#041E3A]');
    expect(wordmark.className).not.toContain('keep-white-text');
  });

  it('applies #020F1D dark background, #041E3A borders & active item pill, and --app-* tokens in light mode', () => {
    const { container } = render(
      <ThemeProvider>
        <Navigation
          currentMode={AppMode.INSIGHTS}
          setMode={mockSetMode}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </ThemeProvider>
    );

    const nav = container.querySelector('nav.nav-sidebar');
    expect(nav?.className).toContain('bg-[#020F1D]');
    expect(nav?.className).toContain('border-[#041E3A]');
    expect(nav?.className).not.toContain('border-white');

    const activeBtn = screen.getByText('Trend Intelligence').closest('button');
    expect(activeBtn?.className).toContain('bg-[#041E3A]');
    expect(activeBtn?.className).toContain('text-white');

    const themeBtn = screen.getByLabelText('Toggle theme');
    expect(themeBtn.className).toContain('hover:bg-[#1A222E]');
    expect(themeBtn.className).toContain('text-slate-200');
    expect(screen.getByText('Dark Mode')).toBeDefined();

    // Switch to Light Mode and verify --app-* classes
    fireEvent.click(themeBtn);
    expect(screen.getByText('Light Mode')).toBeDefined();
    expect(nav?.className).toContain('bg-[var(--app-surface)]');
    expect(nav?.className).toContain('text-[var(--app-text)]');
    expect(activeBtn?.className).toContain('bg-[#041E3A]/8');
    expect(activeBtn?.className).toContain('text-[var(--app-navy)]');
  });

  it('renders pinned test-company workspace at bottom left and routes to AppMode.INSIGHTS', () => {
    const setModeSpy = vi.fn();

    render(
      <ThemeProvider>
        <Navigation
          currentMode={AppMode.INSIGHTS}
          setMode={setModeSpy}
          isMobileMenuOpen={false}
          setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Workspaces')).toBeDefined();
    const workspaceBtn = screen.getByTitle('test-company Workspace');
    expect(workspaceBtn).toBeDefined();
    expect(workspaceBtn.textContent).toBe('test-company');

    workspaceBtn.click();
    expect(setModeSpy).toHaveBeenCalledWith(AppMode.INSIGHTS);
  });

  it('Filters config.navigation to valid AppMode items and appends Filter Pipeline when missing', () => {
    mockUseAppConfig.mockReturnValue({
      config: {
        branding: { companyName: 'test-company' },
        navigation: [
          {
            id: 'INSIGHTS',
            label: 'Trend Intelligence',
            icon: 'Radar',
            visible: true,
            category: 'workflow'
          },
          {
            id: 'LEGACY_REMOVED_MODE',
            label: 'Removed Mode',
            icon: 'FileText',
            visible: true,
            category: 'workflow'
          }
        ]
      } as any
    });

    render(
      <Navigation
        currentMode={AppMode.INSIGHTS}
        setMode={mockSetMode}
        isMobileMenuOpen={false}
        setIsMobileMenuOpen={mockSetIsMobileMenuOpen}
      />
    );

    expect(screen.getByText('Trend Intelligence')).toBeDefined();
    expect(screen.getByText('Filter Pipeline')).toBeDefined();
    expect(screen.queryByText('Removed Mode')).toBeNull();
  });

  it('preserves configured FILTER_PIPELINE item and hides it when visible is false', () => {
    const baseItem = { id: 'INSIGHTS', label: 'Trend Intelligence', icon: 'Radar', visible: true, category: 'workflow' };
    mockUseAppConfig.mockReturnValue({
      config: {
        branding: { companyName: 'test-company' },
        navigation: [baseItem, { id: 'FILTER_PIPELINE', label: 'Filter Pipeline', icon: 'Filter', visible: true, category: 'workflow' }]
      } as any
    });
    const props = { currentMode: AppMode.INSIGHTS, setMode: mockSetMode, isMobileMenuOpen: false, setIsMobileMenuOpen: mockSetIsMobileMenuOpen };
    const { unmount } = render(<Navigation {...props} />);
    expect(screen.getAllByText('Filter Pipeline')).toHaveLength(1);
    unmount();

    mockUseAppConfig.mockReturnValue({
      config: {
        branding: { companyName: 'test-company' },
        navigation: [baseItem, { id: 'FILTER_PIPELINE', label: 'Filter Pipeline', icon: 'Filter', visible: false, category: 'workflow' }]
      } as any
    });
    render(<Navigation {...props} />);
    expect(screen.getByText('Trend Intelligence')).toBeDefined();
    expect(screen.queryByText('Filter Pipeline')).toBeNull();
  });
});
