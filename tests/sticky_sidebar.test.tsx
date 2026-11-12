/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Navigation } from '../components/Navigation';
import { AppMode } from '../types';
import fs from 'fs';
import path from 'path';

// Mock Lucide icons
vi.mock('lucide-react', () => {
  const DummyIcon = (props: any) => <div {...props} />;
  return {
    Home: DummyIcon,
    Menu: DummyIcon,
    X: DummyIcon,
    Users: DummyIcon,
    UserPlus: DummyIcon,
    FileText: DummyIcon,
    Layers: DummyIcon,
    MessageSquare: DummyIcon,
    Target: DummyIcon,
    Eye: DummyIcon,
    Settings: DummyIcon,
    ShieldCheck: DummyIcon,
    CheckSquare: DummyIcon,
    TrendingUp: DummyIcon,
    Layout: DummyIcon,
    Briefcase: DummyIcon,
    Search: DummyIcon,
    Globe: DummyIcon,
    Palette: DummyIcon,
    Image: DummyIcon,
    Grid: DummyIcon,
    Database: DummyIcon,
    Wand2: DummyIcon,
    FolderHeart: DummyIcon,
    HeartHandshake: DummyIcon,
    Film: DummyIcon,
    Cpu: DummyIcon,
    Sparkles: DummyIcon,
    Bot: DummyIcon,
    Workflow: DummyIcon,
    Zap: DummyIcon,
    Compass: DummyIcon,
    ChevronRight: DummyIcon,
    ChevronLeft: DummyIcon,
    PanelLeftClose: DummyIcon,
    PanelLeftOpen: DummyIcon,
    Folder: DummyIcon,
    History: DummyIcon,
    Plus: DummyIcon,
    Trash2: DummyIcon,
    Pencil: DummyIcon,
    Check: DummyIcon,
    Trophy: DummyIcon,
    Swords: DummyIcon,
    Megaphone: DummyIcon,
    Radar: DummyIcon,
    Filter: DummyIcon,
    Sun: DummyIcon,
    Moon: DummyIcon
  };
});

// Mock CompanyContext
vi.mock('../context/CompanyContext', () => ({
  useCompanyContext: () => ({ name: 'test-company' })
}));

// Mock AppConfigContext
vi.mock('../context/AppConfigContext', () => ({
  useAppConfig: () => ({ config: null })
}));

describe('Sticky Navigation & Sidebar Layout', () => {
  it('renders sidebar with sticky positioning and full screen height classes', () => {
    const { container } = render(
      <Navigation
        currentMode={AppMode.INSIGHTS}
        setMode={vi.fn()}
        isMobileMenuOpen={false}
        setIsMobileMenuOpen={vi.fn()}
        isCollapsed={false}
      />
    );

    const nav = container.querySelector('nav');
    expect(nav).toBeDefined();
    expect(nav?.className).toContain('nav-sidebar');
    expect(nav?.className).toContain('md:sticky');
    expect(nav?.className).toContain('top-0');
    expect(nav?.className).toContain('md:self-start');
    expect(nav?.className).toContain('h-screen');
    expect(nav?.className).toContain('overflow-hidden');
    expect(nav?.className).toContain('shrink-0');
    expect(nav?.className).toContain('z-40');
  });

  it('renders internal scrollable items container and pinned bottom-left workspace section', () => {
    const { container } = render(
      <Navigation
        currentMode={AppMode.INSIGHTS}
        setMode={vi.fn()}
        isMobileMenuOpen={false}
        setIsMobileMenuOpen={vi.fn()}
        isCollapsed={false}
      />
    );

    const scrollableMenu = container.querySelector('.overflow-y-auto');
    expect(scrollableMenu).toBeDefined();
    expect(scrollableMenu?.className).toContain('flex-1');
    expect(scrollableMenu?.className).toContain('min-h-0');
    expect(scrollableMenu?.className).toContain('overscroll-contain');

    const bottomWorkspace = container.querySelector('.mt-auto');
    expect(bottomWorkspace).toBeDefined();
    expect(bottomWorkspace?.className).toContain('shrink-0');
    expect(bottomWorkspace?.className).toContain('border-t');
  });

  it('renders mobile backdrop overlay when mobile menu is open', () => {
    const setIsMobileMenuOpen = vi.fn();
    const { container, rerender } = render(
      <Navigation
        currentMode={AppMode.INSIGHTS}
        setMode={vi.fn()}
        isMobileMenuOpen={true}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isCollapsed={false}
      />
    );

    const backdrop = container.querySelector('.bg-black\\/40');
    expect(backdrop).toBeDefined();
    expect(backdrop?.className).toContain('fixed');
    expect(backdrop?.className).toContain('inset-0');

    rerender(
      <Navigation
        currentMode={AppMode.INSIGHTS}
        setMode={vi.fn()}
        isMobileMenuOpen={false}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isCollapsed={false}
      />
    );
    expect(container.querySelector('.bg-black\\/40')).toBeNull();
  });

  it('verifies styles/cockpit-surfaces.css has sticky position rules for .nav-sidebar and no overflow:hidden on .app-container', () => {
    const indexCssPath = path.join(__dirname, '../index.css');
    const cockpitCssPath = path.join(__dirname, '../styles/cockpit-surfaces.css');

    const indexCss = fs.readFileSync(indexCssPath, 'utf8');
    expect(indexCss).toContain("@import './styles/cockpit-surfaces.css';");

    const cockpitCss = fs.readFileSync(cockpitCssPath, 'utf8');
    expect(cockpitCss).toContain('position: sticky;');
    expect(cockpitCss).toContain('align-self: flex-start;');
    expect(cockpitCss).toContain('max-height: 100vh;');
    expect(cockpitCss).not.toMatch(/\.app-container\s*\{[^}]*overflow:\s*hidden/);
  });

  it('verifies App.tsx renders .app-container as flex and .main-content as flex-1 min-w-0', () => {
    const appTsxPath = path.join(__dirname, '../App.tsx');
    const appTsx = fs.readFileSync(appTsxPath, 'utf8');

    expect(appTsx).toContain('app-container font-sans flex min-h-screen w-full relative');
    expect(appTsx).toContain('main-content flex-1 min-w-0');
  });
});
