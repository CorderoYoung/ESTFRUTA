import { useCallback, useEffect, useMemo, useState } from 'react';
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

  

  useEffect(() => {
    console.log('useEstimacionDetalle aggregates changed:', aggregates);
  }, [aggregates]);

  useEffect(() => {
    console.log('useEstimacionDetalle byKey changed:', byKey);
  }, [byKey]);

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
      const result = Math.max(0, Math.trunc(n));
      console.log('countFor:', { key, n, result });
      return result;
    },
    [byKey]
  );

  const setCountFor = useCallback(
    (tipoLinea, codigoClasificacion, cantidad) => {
      const tipo = String(tipoLinea).trim();
      const codigo = String(codigoClasificacion).trim();
      if (!tipo || !codigo) return;

      const value = Number(cantidad);
      const cantidadDelta =
        Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;

      const currentCount = byKey[`${tipo}:${codigo}`] || 0;
      console.log('setCountFor request:', {
        tipo,
        codigo,
        cantidad,
        cantidadDelta,
        currentCount,
      });

      setDetalle((prev) => {
        const next = [];
        let found = false;

        for (const row of prev) {
          if (
            row.tipoLinea === tipo &&
            row.codigoClasificacion === codigo
          ) {
            if (!found && cantidadDelta > 0) {
              next.push({
                ...row,
                cantidadDelta,
                marcaTiempo:
                  typeof row.marcaTiempo === 'string'
                    ? row.marcaTiempo
                    : new Date().toISOString(),
              });
              found = true;
            }
            continue;
          }
          next.push(row);
        }

        if (!found && cantidadDelta > 0) {
          next.push({
            id: nextLocalId(),
            tipoLinea: tipo,
            codigoClasificacion: codigo,
            cantidadDelta,
            marcaTiempo: new Date().toISOString(),
          });
        }

        console.log('setCountFor result state:', {
          prevLength: prev.length,
          nextLength: next.length,
          next,
        });

        return next;
      });
    },
    [byKey]
  );

  const resetDetalle = useCallback(() => setDetalle([]), []);

  const replaceDetalle = useCallback((rows) => {
    const normalized = normalizeDetalleForRestore(rows);
    setDetalle(normalized);
  }, []);

  return {
    detalle,
    aggregates,
    increment,
    decrement,
    countFor,
    setCountFor,
    resetDetalle,
    replaceDetalle,
    TIPO_LINEA,
  };
}
