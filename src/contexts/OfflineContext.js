import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  obtenerRegistrosLocales,
  guardarLocalmente,
  eliminarRegistroLocalById,
  updateRegistroLocal,
  subscribe,
} from '../localStorageService';
import { requestCreateEstimation } from '../services/estimationService';

export const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [registrosLocales, setRegistrosLocales] = useState(() => obtenerRegistrosLocales());

  // subscribe to localStorage service notifications
  useEffect(() => {
    const unsub = subscribe(setRegistrosLocales);
    return () => unsub();
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // automatic sync when connection restored
  useEffect(() => {
    if (!isOnline) return;
    // attempt to sync pending records in background
    (async () => {
      const pendientes = obtenerRegistrosLocales().filter((r) => r.estadoSync !== 'SYNCED');
      for (const r of pendientes) {
        try {
          updateRegistroLocal(r.id, { estadoSync: 'SYNCING' });
          const res = await requestCreateEstimation(r);
          if (res && res.success) {
            eliminarRegistroLocalById(r.id);
          } else {
            updateRegistroLocal(r.id, { estadoSync: 'PENDIENTE_SYNC' });
          }
        } catch (e) {
          updateRegistroLocal(r.id, { estadoSync: 'PENDIENTE_SYNC' });
        }
      }
    })();
  }, [isOnline]);

  const guardarRegistroLocal = useCallback((registro) => guardarLocalmente(registro), []);

  const eliminarRegistroLocal = useCallback((id) => eliminarRegistroLocalById(id), []);

  const actualizarRegistroLocal = useCallback((id, patch) => updateRegistroLocal(id, patch), []);

  const syncRegistro = useCallback(async (id) => {
    const item = obtenerRegistrosLocales().find((r) => r.id === id);
    if (!item) return { success: false, error: 'not_found' };
    try {
      updateRegistroLocal(id, { estadoSync: 'SYNCING' });
      const res = await requestCreateEstimation(item);
      if (res && res.success) {
        eliminarRegistroLocalById(id);
        return { success: true };
      }
      updateRegistroLocal(id, { estadoSync: 'PENDIENTE_SYNC' });
      return { success: false, error: res?.errors || 'sync_failed' };
    } catch (e) {
      updateRegistroLocal(id, { estadoSync: 'PENDIENTE_SYNC' });
      return { success: false, error: e?.message || String(e) };
    }
  }, []);

  const syncAll = useCallback(async () => {
    const pendientes = obtenerRegistrosLocales().map((r) => r.id);
    const results = [];
    for (const id of pendientes) {
      // eslint-disable-next-line no-await-in-loop
      results.push({ id, result: await syncRegistro(id) });
    }
    return results;
  }, [syncRegistro]);

  const value = useMemo(() => ({
    isOnline,
    registrosLocales,
    guardarRegistroLocal,
    eliminarRegistroLocal,
    actualizarRegistroLocal,
    syncRegistro,
    syncAll,
  }), [isOnline, registrosLocales, guardarRegistroLocal, eliminarRegistroLocal, syncRegistro, syncAll]);

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export default OfflineProvider;
