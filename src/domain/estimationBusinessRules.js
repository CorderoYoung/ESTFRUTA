/**
 * Reglas de negocio compartidas (React + futura API Node/SQL Server).
 * GF derivado; FrutasTotales solo desde detalle (empacables + no empacables).
 */

import { FRUIT_SIZE_CODES, TIPO_LINEA } from '../constants/sampling';

function trimPart(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/*
 * GF = Forza + "-" + Semana (valores tal cual en texto, sin espacios extremos).
 * No es entrada manual.
 */
export function deriveGF(forza, semana) {
  const f = trimPart(forza);
  const s = trimPart(semana);
  if (!f || !s) return '';
  return `${f}-${s}`;
}

/* Enteros para conteos operativos (rechaza decimales para guardado). */
export function parseCount(value) {
  const t = trimPart(value);
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

/**
 * Suma por clave tipoLinea:codigo a partir de filas tipo EstimacionDetalle.
 * @param {Array<{ tipoLinea: string, codigoClasificacion: string, cantidadDelta: number }>} detalleRows
 */
export function sumDeltasByKey(detalleRows) {
  const map = {};
  if (!Array.isArray(detalleRows)) return map;
  for (const row of detalleRows) {
    const tipo = trimPart(row?.tipoLinea);
    const codigo = trimPart(row?.codigoClasificacion);
    const delta = Number(row?.cantidadDelta);
    if (!tipo || !codigo || !Number.isFinite(delta)) continue;
    const key = `${tipo}:${codigo}`;
    map[key] = (map[key] || 0) + delta;
  }
  return map;
}

function isPackableSizeCode(codigo) {
  return FRUIT_SIZE_CODES.includes(trimPart(codigo));
}

/**
 * FrutasEmpacables: suma de deltas en lineas TAMANO con codigo 5-12.
 * FrutasNoEmpacables: suma de deltas en lineas DEFECTO.
 */
export function aggregateFrutasFromDetalle(detalleRows) {
  const byKey = sumDeltasByKey(detalleRows);
  let frutasEmpacables = 0;
  let frutasNoEmpacables = 0;

  for (const [key, sum] of Object.entries(byKey)) {
    const net = Math.max(0, Math.trunc(Number(sum) || 0));
    if (net === 0) continue;
    const [tipo, ...rest] = key.split(':');
    const codigo = rest.join(':');
    if (tipo === TIPO_LINEA.TAMANO && isPackableSizeCode(codigo)) {
      frutasEmpacables += net;
    } else if (tipo === TIPO_LINEA.DEFECTO) {
      frutasNoEmpacables += net;
    }
  }

  const frutasTotales = frutasEmpacables + frutasNoEmpacables;
  return { frutasEmpacables, frutasNoEmpacables, frutasTotales };
}

/**
 * FrutasTotales = FrutasEmpacables + FrutasNoEmpacables (solo calculado).
 */
export function computeFrutasTotales(frutasEmpacables, frutasNoEmpacables) {
  const a = Number(frutasEmpacables);
  const b = Number(frutasNoEmpacables);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.trunc(a)) + Math.max(0, Math.trunc(b));
}

/**
 * Habilitar guardar solo si FrutasTotales (calculado) == PtasMuestras.
 */
export function isFrutasTotalesEqualPtasMuestras(frutasTotales, ptasMuestras) {
  const ft = parseCount(frutasTotales);
  const pm = parseCount(ptasMuestras);
  if (ft === null || pm === null) return false;
  return ft === pm;
}

export function canCreateEstimationRecord({
  ptasMuestras,
  frutasTotales,
}) {
  return isFrutasTotalesEqualPtasMuestras(frutasTotales, ptasMuestras);
}

/**
 * Validación para payload de creación (UI + API).
 * El servidor debe recalcular totales desde detalle y no confiar en totales del cliente.
 * @returns {{ ok: boolean, errors: string[], derivedGF: string, aggregates: object }}
 */
export function validateEstimationCreatePayload(payload) {
  const errors = [];
  const gf = deriveGF(payload?.Forza, payload?.Semana);
  if (!gf) {
    errors.push('Forza y Semana son obligatorios para calcular GF.');
  }

  const detalle = Array.isArray(payload?.detalle) ? payload.detalle : [];
  const aggregates = aggregateFrutasFromDetalle(detalle);

  if (!canCreateEstimationRecord({
    ptasMuestras: payload?.PtasMuestras,
    frutasTotales: aggregates.frutasTotales,
  })) {
    errors.push(
      'Frutas Totales (empacables + no empacables) debe ser igual a PtasMuestras.'
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    derivedGF: gf,
    aggregates,
  };
}
