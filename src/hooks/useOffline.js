import { useContext } from 'react';
import { OfflineContext } from '../contexts/OfflineContext';

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return ctx;
}

export default useOffline;
