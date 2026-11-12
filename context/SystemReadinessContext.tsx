import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode
} from 'react';
import { SystemReadinessChecks } from '../types';
import { useCompanyContext } from './CompanyContext';

export interface SystemReadinessContextType {
  checks: SystemReadinessChecks | null;
  isLoading: boolean;
  error: string | null;
  refreshReadiness: (companyOverride?: string) => Promise<void>;
}

const DEFAULT_READINESS_VALUE: SystemReadinessContextType = {
  checks: null,
  isLoading: false,
  error: null,
  refreshReadiness: async () => {}
};

const SystemReadinessContext = createContext<SystemReadinessContextType | undefined>(undefined);

async function extractHttpErrorMessage(response: Response): Promise<string> {
  const statusLabel = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  try {
    const text = await response.text();
    if (!text) return `Startup readiness check failed (${statusLabel}).`;
    try {
      const parsed = JSON.parse(text);
      const detail = parsed?.detail || parsed?.error || parsed?.message;
      if (typeof detail === 'string' && detail.trim()) {
        return `${detail.trim()} (${statusLabel})`;
      }
    } catch {
      return `${text.slice(0, 240).trim()} (${statusLabel})`;
    }
  } catch {
    // Ignore body read error and surface HTTP status
  }
  return `Startup readiness check failed (${statusLabel}).`;
}

export const SystemReadinessProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  let contextCompanyName = 'test-company';
  let isCompanyLoaded = true;
  try {
    const companyCtx = useCompanyContext();
    contextCompanyName = companyCtx.name || 'test-company';
    if (companyCtx.isLoaded !== undefined) {
      isCompanyLoaded = companyCtx.isLoaded;
    }
  } catch {
    // Allow isolated provider testing without CompanyProvider
  }

  const activeCompany = contextCompanyName.trim() || 'test-company';
  const [checks, setChecks] = useState<SystemReadinessChecks | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshReadiness = useCallback(
    async (companyOverride?: string) => {
      const seq = ++requestSeqRef.current;
      const targetCompany = (companyOverride ?? activeCompany).trim() || 'test-company';

      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const res = await fetch(
          `/api/startup-checks?companyName=${encodeURIComponent(targetCompany)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          throw new Error(await extractHttpErrorMessage(res));
        }
        const payload = await res.json();
        if (!payload || typeof payload !== 'object' || payload.success === false || !payload.checks) {
          const msg = payload?.detail || payload?.error || payload?.message || 'Invalid response from /api/startup-checks.';
          throw new Error(String(msg));
        }

        if (isMountedRef.current && seq === requestSeqRef.current) {
          setChecks(payload.checks as SystemReadinessChecks);
          setError(null);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Unable to reach /api/startup-checks to verify workspace integrations.';
        if (isMountedRef.current && seq === requestSeqRef.current) {
          setChecks(null);
          setError(message);
        }
      } finally {
        if (isMountedRef.current && seq === requestSeqRef.current) {
          setIsLoading(false);
        }
      }
    },
    [activeCompany]
  );

  useEffect(() => {
    if (!isCompanyLoaded) return;
    void refreshReadiness(activeCompany);
  }, [activeCompany, isCompanyLoaded, refreshReadiness]);

  const value = useMemo<SystemReadinessContextType>(
    () => ({
      checks,
      isLoading,
      error,
      refreshReadiness
    }),
    [checks, isLoading, error, refreshReadiness]
  );

  return (
    <SystemReadinessContext.Provider value={value}>
      {children}
    </SystemReadinessContext.Provider>
  );
};

/** Returns live startup readiness checks, or a safe uninitialized state outside SystemReadinessProvider. */
export const useSystemReadiness = (): SystemReadinessContextType => {
  const context = useContext(SystemReadinessContext);
  return context ?? DEFAULT_READINESS_VALUE;
};
