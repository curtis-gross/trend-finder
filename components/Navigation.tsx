import React, { useState } from 'react';
import { AppMode } from '../types';
import { brandConfig } from '../config';
import { Search, ChevronRight, PanelLeftOpen } from 'lucide-react';
import { useCompanyContext } from '../context/CompanyContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppConfig } from '../context/AppConfigContext';
import {
  RadarIcon,
  IconMap,
  LIGHT_ACTIVE_NAV_PILL_CLASSES,
  DARK_ACTIVE_NAV_PILL_CLASSES,
  LIGHT_INACTIVE_NAV_PILL_CLASSES,
  DARK_INACTIVE_NAV_PILL_CLASSES,
  LIGHT_ACTIVE_NAV_ICON_CLASSES,
  DARK_ACTIVE_NAV_ICON_CLASSES,
  LIGHT_INACTIVE_NAV_ICON_CLASSES,
  DARK_INACTIVE_NAV_ICON_CLASSES,
  DEFAULT_NAVIGATION,
  resolveBrandWordmarks
} from './navigation/navigationConstants';
import { NavigationHeaderBar } from './navigation/NavigationHeaderBar';
import { NavigationWorkspaceFooter } from './navigation/NavigationWorkspaceFooter';

export interface NavigationProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentMode,
  setMode,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isCollapsed: isCollapsedProp = false,
  onToggleCollapse
}) => {
  const isCollapsed = Boolean(isCollapsedProp) && !isMobileMenuOpen;

  const handleShowSidebar = () => {
    if (isCollapsedProp && onToggleCollapse) onToggleCollapse();
    else setIsMobileMenuOpen(true);
  };

  const handleHideSidebar = () => {
    if (onToggleCollapse && !isCollapsedProp) onToggleCollapse();
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  const { name } = useCompanyContext();
  const { config } = useAppConfig();

  let theme: 'light' | 'dark' =
    typeof document !== 'undefined' &&
    (document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark')
      ? 'dark'
      : 'light';
  let toggleTheme = () => {};
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
    toggleTheme = themeContext.toggleTheme;
  } catch {
    // Isolated render fallback
  }

  const isDark = theme === 'dark';
  const activeNavPillClasses = isDark ? DARK_ACTIVE_NAV_PILL_CLASSES : LIGHT_ACTIVE_NAV_PILL_CLASSES;
  const inactiveNavPillClasses = isDark ? DARK_INACTIVE_NAV_PILL_CLASSES : LIGHT_INACTIVE_NAV_PILL_CLASSES;
  const activeNavIconClasses = isDark ? DARK_ACTIVE_NAV_ICON_CLASSES : LIGHT_ACTIVE_NAV_ICON_CLASSES;
  const inactiveNavIconClasses = isDark ? DARK_INACTIVE_NAV_ICON_CLASSES : LIGHT_INACTIVE_NAV_ICON_CLASSES;
  const collapsedInactiveNavIconClasses = isDark
    ? 'bg-transparent dark:bg-transparent border-transparent dark:border-transparent shadow-none dark:shadow-none text-[#D1D9E6] dark:text-[#D1D9E6] group-hover:text-white dark:group-hover:text-white'
    : 'text-slate-500 dark:bg-transparent dark:text-[#D1D9E6] dark:group-hover:text-white';

  const [searchQuery, setSearchQuery] = useState('');
  const [isWorkflowsExpanded, setIsWorkflowsExpanded] = useState(true);
  const isWorkflowsOpen = isWorkflowsExpanded || searchQuery.trim().length > 0;

  const { expandedWordmark, collapsedWordmark } = resolveBrandWordmarks(
    config?.branding?.companyName || name || brandConfig.companyName || 'test-company'
  );
  const workspaceName =
    (config?.branding as any)?.workspaceName ||
    config?.branding?.companyName ||
    name ||
    brandConfig.workspaceName ||
    'test-company';

  const workflowItems = React.useMemo(() => {
    const validModes = Object.values(AppMode) as string[];
    const toMode = (raw: unknown): AppMode | null => {
      const id = String(raw ?? '').toUpperCase();
      return validModes.includes(id) ? (id as AppMode) : null;
    };
    const fallbackFor = (id: AppMode) => DEFAULT_NAVIGATION.find(d => d.id === id);
    const configured: any[] =
      config?.navigation && Array.isArray(config.navigation) && config.navigation.length > 0
        ? config.navigation
        : [];
    const hiddenModes = new Set(
      configured.filter((item: any) => item?.visible === false).map((item: any) => toMode(item?.id)).filter(Boolean)
    );
    const seen = new Set<AppMode>();
    const items: { id: AppMode; label: string; icon: string }[] = [];
    for (const item of configured) {
      const id = toMode(item?.id);
      if (!id || seen.has(id) || item?.visible === false) continue;
      seen.add(id);
      const fallback = fallbackFor(id);
      items.push({ id, label: item.label || fallback?.label || id, icon: item.icon || fallback?.icon || 'Radar' });
    }
    for (const def of DEFAULT_NAVIGATION) {
      if (!seen.has(def.id) && !hiddenModes.has(def.id)) {
        if (def.id === AppMode.INSIGHTS) items.unshift({ ...def });
        else items.push({ ...def });
        seen.add(def.id);
      }
    }
    return items.length > 0 ? items : DEFAULT_NAVIGATION.map(def => ({ ...def }));
  }, [config?.navigation]);

  const filteredWorkflows = workflowItems.filter(item =>
    !searchQuery.trim() ? true : item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-2xs transition-opacity"
          onClick={handleHideSidebar}
          aria-hidden="true"
        />
      )}

      {(isCollapsed || !isMobileMenuOpen) && (
        <button
          type="button"
          onClick={handleShowSidebar}
          aria-label="Open navigation sidebar"
          title="Open sidebar"
          className={`absolute top-3 left-4 sm:left-6 z-50 h-8 px-2.5 gap-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex-row items-center justify-center whitespace-nowrap shrink-0 focus:outline-hidden focus:ring-2 focus:ring-[#041E3A]/50 ${
            isDark
              ? 'bg-[#020F1D] border-[#041E3A] hover:bg-[#1A222E] text-[#D8E1EB] hover:text-white'
              : 'bg-[var(--app-surface)] border-[#E2E8F0] shadow-xs hover:bg-slate-50 text-[var(--app-text)]'
          } dark:bg-[#020F1D] dark:border-[#041E3A] dark:hover:bg-[#1A222E] dark:text-[#D8E1EB] dark:hover:text-white ${
            isCollapsed ? 'flex' : 'flex md:hidden'
          }`}
        >
          <PanelLeftOpen size={15} className={`${isDark ? 'text-[#D1D9E6]' : 'text-[var(--app-navy)]'} dark:text-[#D1D9E6] shrink-0`} />
          <span>Sidebar</span>
        </button>
      )}

      <nav
        className={`nav-sidebar fixed md:sticky top-0 left-0 md:left-auto bottom-0 md:bottom-auto md:self-start h-screen max-h-screen border-r transition-all duration-300 ease-in-out pt-0 flex flex-col overflow-hidden shrink-0 z-40 ${
          isDark ? 'bg-[#020F1D] border-[#041E3A] text-[#F8F6F0]' : 'bg-[var(--app-surface)] border-[#E2E8F0] text-[var(--app-text)]'
        } dark:bg-[#020F1D] dark:border-[#041E3A] dark:text-[#F8F6F0] ${
          isCollapsed ? '-translate-x-full' : isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'collapsed w-0 min-w-0 max-w-0 md:w-0 border-r-0 border-transparent bg-transparent opacity-0 pointer-events-none' : 'w-72 max-w-[85vw]'}`}
        style={isCollapsed ? { width: 0, minWidth: 0, maxWidth: 0, borderRight: 'none', backgroundColor: 'transparent', boxShadow: 'none' } : undefined}
        aria-hidden={isCollapsed ? 'true' : undefined}
      >
        <NavigationHeaderBar
          isCollapsed={isCollapsed}
          isDark={isDark}
          isMobileMenuOpen={isMobileMenuOpen}
          hasToggleCollapse={Boolean(onToggleCollapse)}
          expandedWordmark={expandedWordmark}
          collapsedWordmark={collapsedWordmark}
          onShowSidebar={handleShowSidebar}
          onHideSidebar={handleHideSidebar}
          setMode={setMode}
        />

        {!isCollapsed && (
          <div className="px-3 py-1.5 shrink-0">
            <div className="relative">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#D1D9E6]' : 'text-slate-400'} dark:text-[#D1D9E6]`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workflows"
                className={`w-full pl-8 pr-3 py-1.5 text-xs border rounded-xl focus:outline-none transition-colors ${
                  isDark
                    ? 'bg-[#020F1D] border-[#041E3A] focus:border-[#0B3B70] focus:bg-[#041E3A]/40 text-slate-100 placeholder:text-slate-300/70'
                    : 'bg-slate-50 border-[#CBD5E1] focus:border-[#041E3A] focus:bg-[var(--app-surface)] text-[var(--app-text)] placeholder:text-slate-400'
                } dark:bg-[#020F1D] dark:border-[#041E3A] dark:focus:border-[#0B3B70] dark:focus:bg-[#041E3A]/40 dark:text-slate-100 dark:placeholder:text-slate-300/70`}
              />
            </div>
          </div>
        )}

        <div className={`p-2 space-y-1 flex-1 min-h-0 overflow-y-auto overscroll-contain ${isCollapsed ? 'px-1.5' : 'px-2'}`}>
          {filteredWorkflows.length > 0 && (
            <div className="space-y-0.5">
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsWorkflowsExpanded(!isWorkflowsExpanded)}
                  className={`w-full px-2 py-1.5 flex items-center justify-between rounded-lg transition-all group cursor-pointer ${
                    isDark ? 'text-slate-300 hover:text-white hover:bg-[#1A222E]' : 'text-slate-500 hover:text-[var(--app-text)] hover:bg-slate-100'
                  } dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#1A222E]`}
                  title={isWorkflowsOpen ? 'Collapse Workflows' : 'Expand Workflows'}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ChevronRight
                      size={13}
                      className={`transition-transform duration-200 ${
                        isDark
                          ? `text-slate-300 group-hover:text-white ${isWorkflowsOpen ? 'rotate-90 text-slate-200' : ''}`
                          : `text-slate-400 group-hover:text-slate-700 ${isWorkflowsOpen ? 'rotate-90 text-slate-600' : ''}`
                      } dark:text-slate-300 dark:group-hover:text-white`}
                    />
                    <span className={`text-[10px] font-black uppercase tracking-wider truncate ${
                      isDark ? 'text-slate-300 group-hover:text-white' : 'text-slate-500 group-hover:text-slate-800'
                    } dark:text-slate-300 dark:group-hover:text-white`}>
                      Workflows
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full transition-colors ${
                    isDark ? 'text-slate-200 bg-[#041E3A] group-hover:text-white border-[#041E3A]' : 'text-slate-600 bg-slate-100 group-hover:bg-slate-200 border-[#E2E8F0]'
                  } dark:text-slate-200 dark:bg-[#041E3A] dark:group-hover:text-white dark:border-[#041E3A]`}>
                    {filteredWorkflows.length}
                  </span>
                </button>
              )}

              {(isWorkflowsOpen || isCollapsed) && (
                <div className="space-y-1 pt-0.5 animate-fadeIn">
                  {filteredWorkflows.map((item) => {
                    const isActive = currentMode === item.id;
                    const Icon = IconMap[item.icon as string] || RadarIcon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setMode(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        title={isCollapsed ? item.label : undefined}
                        className={`w-full flex items-center rounded-xl transition-all duration-150 font-medium text-xs cursor-pointer ${
                          isCollapsed
                            ? `justify-center p-2.5 ${isActive ? activeNavPillClasses : inactiveNavPillClasses}`
                            : `justify-between px-3 py-2.5 ${isActive ? activeNavPillClasses : inactiveNavPillClasses}`
                        }`}
                      >
                        {isCollapsed ? (
                          <div className={`p-1 rounded-lg ${isActive ? activeNavIconClasses : collapsedInactiveNavIconClasses}`} style={isDark ? { backgroundColor: 'transparent' } : undefined}>
                            {React.createElement(Icon, { size: 16 })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-1 rounded-lg ${isActive ? activeNavIconClasses : inactiveNavIconClasses}`} style={isDark ? { backgroundColor: 'transparent' } : undefined}>
                              {React.createElement(Icon, { size: 15 })}
                            </div>
                            <span className="truncate font-semibold">{item.label}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <NavigationWorkspaceFooter
          isCollapsed={isCollapsed}
          isDark={isDark}
          theme={theme}
          toggleTheme={toggleTheme}
          workspaceName={workspaceName}
          setMode={setMode}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
      </nav>
    </>
  );
};
