import { Sun, Moon, Radar, TrendingUp, Search, Sparkles, FileText, Folder, Filter } from 'lucide-react';
import { AppMode } from '../../types';

const NAMED_ICONS: Record<string, any> = {
  Sun,
  Moon,
  Radar,
  TrendingUp,
  Search,
  Sparkles,
  FileText,
  Folder,
  Filter
};

const safeIcon = (name: string): any => {
  try {
    return NAMED_ICONS[name] || Sparkles;
  } catch {
    return Sparkles;
  }
};

export const SunIcon = safeIcon('Sun');
export const MoonIcon = safeIcon('Moon');
export const RadarIcon = safeIcon('Radar');
export const FilterIcon = safeIcon('Filter');

export const IconMap: Record<string, any> = {
  Radar: RadarIcon,
  TrendingUp,
  Search,
  Sparkles,
  FileText,
  Filter: FilterIcon
};

export const LIGHT_ACTIVE_NAV_PILL_CLASSES =
  'bg-[#041E3A]/8 text-[var(--app-navy)] font-bold shadow-2xs border border-[#041E3A]/25 border-l-4 border-l-[#041E3A] dark:bg-[#041E3A] dark:text-white dark:border-transparent';
export const DARK_ACTIVE_NAV_PILL_CLASSES =
  'bg-[#041E3A] dark:bg-[#041E3A] text-white dark:text-white font-semibold border border-transparent';

export const LIGHT_INACTIVE_NAV_PILL_CLASSES =
  'group text-slate-600 hover:bg-slate-100 hover:text-[var(--app-text)] dark:bg-transparent dark:text-[#D8E1EB] dark:hover:bg-[#1A222E] dark:hover:text-white border border-transparent';
export const DARK_INACTIVE_NAV_PILL_CLASSES =
  'group bg-transparent dark:bg-transparent text-[#D8E1EB] dark:text-[#D8E1EB] hover:bg-[#1A222E] dark:hover:bg-[#1A222E] hover:text-white dark:hover:text-white border border-transparent';

export const LIGHT_ACTIVE_NAV_ICON_CLASSES =
  'bg-[#041E3A]/12 text-[var(--app-navy)] dark:bg-transparent dark:border-transparent dark:shadow-none dark:text-white';
export const DARK_ACTIVE_NAV_ICON_CLASSES =
  'bg-transparent dark:bg-transparent border-transparent dark:border-transparent shadow-none dark:shadow-none text-white dark:text-white';

export const LIGHT_INACTIVE_NAV_ICON_CLASSES =
  'bg-slate-100 text-slate-500 dark:bg-transparent dark:border-transparent dark:shadow-none dark:text-[#D1D9E6] dark:group-hover:text-white';
export const DARK_INACTIVE_NAV_ICON_CLASSES =
  'bg-transparent dark:bg-transparent border-transparent dark:border-transparent shadow-none dark:shadow-none text-[#D1D9E6] dark:text-[#D1D9E6] group-hover:text-white dark:group-hover:text-white';

export const DEFAULT_NAVIGATION = [
  {
    id: AppMode.INSIGHTS,
    label: 'Trend Intelligence',
    icon: 'Radar'
  },
  {
    id: AppMode.FILTER_PIPELINE,
    label: 'Filter Pipeline',
    icon: 'Filter'
  }
];

export const resolveBrandWordmarks = (rawName: string) => {
  const companyName = (rawName || 'test-company').trim();
  const expandedWordmark = (companyName || 'test-company').toUpperCase();
  const collapsedWordmark =
    companyName.toLowerCase() === 'test-company'
      ? 'TC'
      : companyName
          .split(/[\s-]+/)
          .filter(Boolean)
          .map(part => part[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'TC';
  return { companyName, expandedWordmark, collapsedWordmark };
};
