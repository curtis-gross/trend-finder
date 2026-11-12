import React from 'react';
import { Folder } from 'lucide-react';
import { AppMode } from '../../types';
import { SunIcon, MoonIcon } from './navigationConstants';

interface NavigationWorkspaceFooterProps {
  isCollapsed: boolean;
  isDark: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  workspaceName: string;
  setMode: (mode: AppMode) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
}

export const NavigationWorkspaceFooter: React.FC<NavigationWorkspaceFooterProps> = ({
  isCollapsed,
  isDark,
  theme,
  toggleTheme,
  workspaceName,
  setMode,
  setIsMobileMenuOpen
}) => {
  return (
    <div
      className={`mt-auto shrink-0 border-t backdrop-blur-xs ${
        isDark ? 'border-[#041E3A] bg-[#020F1D]' : 'border-[#E2E8F0] bg-[var(--app-surface)]/95'
      } dark:border-[#041E3A] dark:bg-[#020F1D] ${isCollapsed ? 'p-2' : 'p-3'}`}
    >
      {!isCollapsed ? (
        <div>
          <div className={`flex items-center justify-between text-[11px] font-medium px-1 mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-500'} dark:text-slate-300`}>
            <span className="flex items-center gap-1.5">
              <Folder size={13} className={isDark ? 'text-[#D1D9E6]' : 'text-[#9C7A3C]'} /> Workspaces
            </span>
          </div>
          <div
            className={`flex flex-row items-center gap-1 flex-nowrap min-w-0 border rounded-xl p-1 shadow-2xs transition-colors ${
              isDark ? 'bg-[#020F1D] border-[#041E3A]' : 'bg-slate-50 border-[#E2E8F0] hover:border-slate-300'
            } dark:bg-[#020F1D] dark:border-[#041E3A]`}
          >
            <button
              onClick={() => {
                setMode(AppMode.INSIGHTS);
                setIsMobileMenuOpen(false);
              }}
              className={`flex-1 min-w-0 text-left px-2.5 py-1.5 text-xs font-bold truncate rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-slate-200 hover:text-white hover:bg-[#1A222E]' : 'text-[var(--app-text)] hover:text-[var(--app-navy)]'
              } dark:hover:bg-[#1A222E] dark:hover:text-white`}
              title={`${workspaceName} Workspace`}
            >
              {workspaceName}
            </button>
            <button
              onClick={toggleTheme}
              className={`flex flex-row items-center gap-1.5 px-2 py-1.5 rounded-lg bg-transparent dark:bg-transparent transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                isDark ? 'text-slate-200 hover:text-white hover:bg-[#1A222E]' : 'text-slate-500 hover:text-[var(--app-text)] hover:bg-slate-200/70'
              } dark:text-slate-200 dark:hover:text-white dark:hover:bg-[#1A222E]`}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <>
                  <MoonIcon size={14} className="text-[#D1D9E6] dark:text-[#D1D9E6] shrink-0" />
                  <span className="text-xs font-semibold text-slate-200 dark:text-slate-200 whitespace-nowrap">Dark Mode</span>
                </>
              ) : (
                <>
                  <SunIcon size={14} className="text-amber-500 shrink-0" />
                  <span className="text-xs font-semibold whitespace-nowrap">Light Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => {
              setMode(AppMode.INSIGHTS);
              setIsMobileMenuOpen(false);
            }}
            className={`p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center ${
              isDark ? 'bg-transparent text-[#D1D9E6] hover:bg-[#1A222E] hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-[var(--app-text)]'
            } dark:hover:bg-[#1A222E] dark:hover:text-white`}
            title={workspaceName}
          >
            <Folder size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
