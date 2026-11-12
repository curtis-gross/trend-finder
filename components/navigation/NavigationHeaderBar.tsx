import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AppMode } from '../../types';

interface NavigationHeaderBarProps {
  isCollapsed: boolean;
  isDark: boolean;
  isMobileMenuOpen: boolean;
  hasToggleCollapse: boolean;
  expandedWordmark: string;
  collapsedWordmark: string;
  onShowSidebar: () => void;
  onHideSidebar: () => void;
  setMode: (mode: AppMode) => void;
}

export const NavigationHeaderBar: React.FC<NavigationHeaderBarProps> = ({
  isCollapsed,
  isDark,
  isMobileMenuOpen,
  hasToggleCollapse,
  expandedWordmark,
  collapsedWordmark,
  onShowSidebar,
  onHideSidebar,
  setMode
}) => {
  const wordmarkFontStyle = {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: isDark ? '#FFFFFF' : '#041E3A'
  };

  return (
    <div
      className={`relative flex items-center justify-center p-3 border-b shrink-0 ${
        isDark ? 'border-[#041E3A] bg-[#020F1D]' : 'border-[#E2E8F0] bg-[var(--app-surface)]'
      } dark:border-[#041E3A] dark:bg-[#020F1D]`}
      style={{ minHeight: '4.5rem' }}
    >
      {isCollapsed ? (
        <div className="flex flex-col items-center justify-center w-full gap-2 bg-transparent">
          <button
            type="button"
            onClick={onShowSidebar}
            aria-label="Open navigation sidebar"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer bg-transparent dark:bg-transparent ${
              isDark ? 'text-[#D1D9E6] hover:text-white hover:bg-[#1A222E]' : 'text-slate-500 hover:text-[var(--app-text)] hover:bg-slate-100'
            } dark:text-[#D1D9E6] dark:hover:text-white dark:hover:bg-[#1A222E]`}
            title="Open sidebar"
          >
            <PanelLeftOpen size={18} />
          </button>
          <div
            onClick={() => setMode(AppMode.INSIGHTS)}
            className="w-9 h-9 rounded-md bg-transparent flex items-center justify-center cursor-pointer overflow-hidden mx-auto"
            title="Trend Intelligence"
          >
            <span
              className={`app-wordmark font-studio-sans uppercase font-semibold text-sm leading-none tracking-[0.14em] select-none ${
                isDark ? 'text-white keep-white-text' : 'text-[#041E3A] dark:text-white'
              }`}
              style={{ ...wordmarkFontStyle, letterSpacing: '0.14em' }}
            >
              {collapsedWordmark}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-row items-center justify-between gap-2 w-full bg-transparent min-w-0">
          <div
            onClick={() => setMode(AppMode.INSIGHTS)}
            className="flex flex-row items-center justify-start bg-transparent rounded-md pl-0.5 pr-8 py-1.5 cursor-pointer group min-w-0 flex-1"
            title="Trend Intelligence"
          >
            <span
              className={`app-wordmark font-studio-sans uppercase whitespace-nowrap truncate font-semibold text-[18px] leading-none tracking-[0.16em] select-none transition-opacity group-hover:opacity-90 ${
                isDark ? 'text-white keep-white-text' : 'text-[#041E3A] dark:text-white'
              }`}
              style={{ ...wordmarkFontStyle, letterSpacing: '0.16em' }}
            >
              {expandedWordmark}
            </span>
          </div>
          {(hasToggleCollapse || isMobileMenuOpen) && (
            <button
              type="button"
              onClick={onHideSidebar}
              aria-label="Hide navigation sidebar"
              className={`flex flex-row items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-transparent dark:bg-transparent transition-colors cursor-pointer shrink-0 ${
                isDark ? 'text-[#D1D9E6] hover:text-white hover:bg-[#1A222E]' : 'text-slate-500 hover:text-[var(--app-text)] hover:bg-slate-100'
              } dark:text-[#D1D9E6] dark:hover:text-white dark:hover:bg-[#1A222E]`}
              title="Hide sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
