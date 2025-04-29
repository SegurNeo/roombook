import { createContext, useContext, ReactNode } from 'react';
import { Settings } from '@/lib/format';
import { useSettings } from '@/hooks/use-settings';
import { LoadingOverlay } from '@/components/loading-overlay';

interface FormatContextType {
  settings: Settings;
  loading: boolean;
}

const FormatContext = createContext<FormatContextType>({
  settings: {
    language: 'en',
    region: 'eu',
    currency: 'eur',
    dateFormat: 'dd/mm/yyyy',
    numberFormat: '1,234.56',
    measurementUnit: 'metric'
  },
  loading: false
});

export function FormatProvider({ children }: { children: ReactNode }) {
  const { settings, loading } = useSettings();

  return (
    <FormatContext.Provider value={{ settings, loading }}>
      <LoadingOverlay loading={loading} message="Applying regional settings..." />
      {children}
    </FormatContext.Provider>
  );
}

export function useFormat() {
  return useContext(FormatContext);
}