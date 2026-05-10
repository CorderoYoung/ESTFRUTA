import { deriveGF, parseCount } from './estimationBusinessRules';

function trim(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** Area: número finito (permite decimales, ej. 0.75). */
export function parseArea(value) {
  const t = trim(value);
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Validación paso 1 — cabecera antes de iniciar muestreo.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateEstimationHeader(header) {
  const errors = [];
  const h = header || {};

  if (!trim(h.Tipo)) errors.push('Tipo es obligatorio.');
  if (!trim(h.Cosecha)) errors.push('Cosecha es obligatorio.');
  if (!trim(h.Semana)) errors.push('Semana es obligatoria.');
  const semana = parseCount(h.Semana);
  if (semana === null || semana < 1 || semana > 53) {
    errors.push('Semana debe estar entre 1 y 53.');
  }
  if (!trim(h.Forza)) errors.push('Forza es obligatoria.');
  if (!trim(h.Lote)) errors.push('Lote es obligatorio.');
  if (!trim(h.Parcela)) errors.push('Parcela es obligatoria.');
  if (!trim(h.Poblacion)) errors.push('Poblacion es obligatoria.');

  if (parseCount(h.PtasEstac) === null) {
    errors.push('PtasEstac debe ser un entero valido.');
  }
  if (parseCount(h.PtasMues) === null) {
    errors.push('PtasMues debe ser un entero valido.');
  }
  if (parseArea(h.Area) === null) {
    errors.push('Area debe ser un numero valido.');
  }

  const gf = deriveGF(h.Forza, h.Semana);
  if (!gf) {
    errors.push('GF no puede calcularse: revise Forza y Semana.');
  }

  return { ok: errors.length === 0, errors, derivedGF: gf };
}
