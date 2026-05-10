import { useCallback, useMemo, useState } from 'react';
import {
  aggregateFrutasFromDetalle,
  sumDeltasByKey,
} from '../domain/estimationBusinessRules';
import { TIPO_LINEA } from '../constants/sampling';
import { normalizeDetalleForRestore } from '../services/operationalDraftStorage';

let seq = 0;
function nextLocalId() {
  seq += 1;
  return `evt-${Date.now()}-${seq}`;
}

/**
 * Estado transaccional alineado a EstimacionDetalle (eventos +/-).
 * Totales en tiempo real vía aggregateFrutasFromDetalle.
 */
export function useEstimacionDetalle() {
  const [detalle, setDetalle] = useState([]);

  const byKey = useMemo(() => sumDeltasByKey(detalle), [detalle]);

  const aggregates = useMemo(
    () => aggregateFrutasFromDetalle(detalle),
    [detalle]
  );

  const applyDelta = useCallback((tipoLinea, codigoClasificacion, cantidadDelta) => {
    const tipo = String(tipoLinea).trim();
    const codigo = String(codigoClasificacion).trim();
    if (!tipo || !codigo) return;

    setDetalle((prev) => {
      const map = sumDeltasByKey(prev);
      const key = `${tipo}:${codigo}`;
      const current = map[key] || 0;
      if (cantidadDelta < 0 && current + cantidadDelta < 0) {
        return prev;
      }
      return [
        ...prev,
        {
          id: nextLocalId(),
          tipoLinea: tipo,
          codigoClasificacion: codigo,
          cantidadDelta,
          marcaTiempo: new Date().toISOString(),
        },
      ];
    });
  }, []);

  const increment = useCallback(
    (tipoLinea, codigo) => applyDelta(tipoLinea, codigo, 1),
    [applyDelta]
  );

  const decrement = useCallback(
    (tipoLinea, codigo) => applyDelta(tipoLinea, codigo, -1),
    [applyDelta]
  );

  const countFor = useCallback(
    (tipoLinea, codigo) => {
      const key = `${String(tipoLinea).trim()}:${String(codigo).trim()}`;
      const n = byKey[key] || 0;
      return Math.max(0, Math.trunc(n));
    },
    [byKey]
  );

  const resetDetalle = useCallback(() => setDetalle([]), []);

  const replaceDetalle = useCallback((rows) => {
    setDetalle(normalizeDetalleForRestore(rows));
  }, []);

  return {
    detalle,
    aggregates,
    increment,
    decrement,
    countFor,
    resetDetalle,
    replaceDetalle,
    TIPO_LINEA,
  };
}
