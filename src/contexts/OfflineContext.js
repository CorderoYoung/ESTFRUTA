import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  obtenerRegistrosLocales,
  guardarLocalmente,
  eliminarRegistroLocalById,
  updateRegistroLocal,
  subscribe,
} from '../localStorageService';
import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  aggregateFrutasFromDetalle,
  deriveGf,
} from '../domain/estimationBusinessRules';

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

  const guardarRegistroLocal = useCallback((registro) => guardarLocalmente(registro), []);

  const eliminarRegistroLocal = useCallback((id) => eliminarRegistroLocalById(id), []);

  const actualizarRegistroLocal = useCallback((id, patch) => updateRegistroLocal(id, patch), []);

  const buildFirestorePayload = useCallback((record) => {
    const detalle = Array.isArray(record.detalle)
      ? record.detalle
      : Array.isArray(record.Detalle)
      ? record.Detalle
      : [];

    const aggregates = aggregateFrutasFromDetalle(detalle);

    const cosecha = record.Cosecha || record.cosecha || record.pc || '';
    const tipo = record.Tipo || record.tipo || '';
    const semana = Number(record.Semana ?? record.semana) || 0;
    const forza = Number(record.Forza ?? record.forza) || 0;
    const lote = Number(record.Lote ?? record.lote) || 0;
    const parcela = Number(record.Parcela ?? record.parcela ?? record.seccion) || 0;
    const poblacion = Number(record.Poblacion ?? record.poblacion) || 0;
    const ptasEstac = Number(record.PtasEstac ?? record.ptasEstac) || 0;
    const ptasMues = Number(
      (record.PtasMuestras ?? record.PtasMues ?? record.ptasMues) || 0
    ) || 0;
    const area = Number(record.Area ?? record.area) || 0;

    return {
      cosecha,
      Cosecha: cosecha,
      tipo,
      Tipo: tipo,
      semana,
      Semana: semana,
      forza,
      Forza: forza,
      lote,
      Lote: lote,
      parcela,
      Parcela: parcela,
      poblacion,
      Poblacion: poblacion,
      ptasEstac,
      PtasEstac: ptasEstac,
      ptasMues,
      PtasMues: ptasMues,
      PtasMuestras: ptasMues,
      area,
      Area: area,
      detalle,
      frutasEmpacables: aggregates.frutasEmpacables,
      frutasNoEmpacables: aggregates.frutasNoEmpacables,
      frutasTotales: aggregates.frutasTotales,
      GF: deriveGf(record.Forza ?? record.forza, record.Semana ?? record.semana) || '',
      uniqueKey: record.uniqueKey || record.uniqueId || null,
      createdAt: new Date().toISOString(),
      isHeaderOnly: detalle.length === 0,
    };
  }, []);

  const syncRegistro = useCallback(async (itemOrId) => {
    const ts = new Date().toISOString();
    const item =
      typeof itemOrId === 'string'
        ? obtenerRegistrosLocales().find((r) => r.id === itemOrId)
        : itemOrId;

    console.log('[diag] syncRegistro START', ts, { itemOrId });
    try {
      console.log('[diag] syncRegistro STACK', new Error().stack);
    } catch (e) {
      // ignore
    }

    if (!item || !item.id) {
      console.log('[diag] syncRegistro NOT_FOUND', ts, { item });
      return { success: false, error: 'not_found' };
    }

    const localId = item.id;
    console.log('[diag] syncRegistro resolved id', ts, { localId });
    updateRegistroLocal(localId, { estadoSync: 'SYNCING' });

    try {
      const payload = buildFirestorePayload(item);
      let docIdToSync = null;

      if (payload.uniqueKey) {
        const q = query(
          collection(db, 'estimaciones'),
          where('uniqueKey', '==', payload.uniqueKey)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          docIdToSync = querySnapshot.docs[0].id;
        }
      }

      if (docIdToSync) {
        await updateDoc(doc(db, 'estimaciones', docIdToSync), payload);
      } else {
        const created = await addDoc(collection(db, 'estimaciones'), payload);
        docIdToSync = created.id;
      }

      eliminarRegistroLocalById(localId);
      return { success: true, estimationId: docIdToSync };
    } catch (e) {
      updateRegistroLocal(localId, { estadoSync: 'PENDIENTE_SYNC' });
      console.error('[OfflineContext] syncRegistro error', e);
      return { success: false, error: e?.message || String(e) };
    }
  }, [buildFirestorePayload]);

  const syncAll = useCallback(async () => {
    const ts = new Date().toISOString();
    const pendientes = obtenerRegistrosLocales().map((r) => r.id);
    console.log('[diag] syncAll START', ts, { count: pendientes.length, pendientes });
    try {
      console.log('[diag] syncAll STACK', new Error().stack);
    } catch (e) {
      // ignore
    }
    const results = [];
    for (const id of pendientes) {
      // eslint-disable-next-line no-await-in-loop
      results.push({ id, result: await syncRegistro(id) });
    }
    console.log('[diag] syncAll END', new Date().toISOString(), { resultsCount: results.length });
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

  // Automatic sync on reconnect removed.
  // Synchronization must be initiated manually by calling `syncRegistro` or `syncAll`.
  // This preserves offline persistence, editing, and manual sync buttons.

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export default OfflineProvider;
