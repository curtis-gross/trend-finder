import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AppConfig {
  branding: {
    companyName: string;
    logo: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
    };
    logoHeight?: number;
    metaTitle: string;
    industryType?: string;
  };
  navigation: {
    id: string;
    label: string;
    icon: string;
  }[];
}

interface AppConfigContextType {
  config: AppConfig | null;
  isLoading: boolean;
}

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);

export const AppConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/admin/config');
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        }
      } catch (e) {
        console.error("Error loading app config:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  return (
    <AppConfigContext.Provider value={{ config, isLoading }}>
      {children}
    </AppConfigContext.Provider>
  );
};

export const useAppConfig = () => {
  const context = useContext(AppConfigContext);
  if (context === undefined) {
    throw new Error('useAppConfig must be used within an AppConfigProvider');
  }
  return context;
};
