import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CompanyContextType {
  name: string;
  isLoaded: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [name, setName] = useState<string>('test-company');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadCompanyContext = async () => {
      try {
        const response = await fetch('/api/load-run/company_context');
        if (response.ok) {
          const data = await response.json();
          if (data.name) setName(data.name);
        }
      } catch (e) {
        console.error('Error loading company context from filesystem:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadCompanyContext();
  }, []);

  return (
    <CompanyContext.Provider
      value={{
        name,
        isLoaded
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompanyContext = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompanyContext must be used within a CompanyProvider');
  }
  return context;
};
