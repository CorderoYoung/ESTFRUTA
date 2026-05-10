import { ESTIMACION_HEADER_STORAGE_KEY } from '../constants/estimationContext';

export const OPERATIONAL_DRAFT_VERSION = 1;

/** Persistencia durable entre cierres (PWA / movil). */
export const OPERATIONAL_DRAFT_LOCAL_KEY = 'estfruta_operational_draft_v1';

/** Espejo de sesion (misma carga util; refresco en misma sesion). */
export const OPERATIONAL_DRAFT_SESSION_KEY = 'estfruta_operational_draft_session_v1';

function trim(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Huella estable de cabecera: si cambia, el muestreo guardado no aplica.
 */
export function getHeaderFingerprint(header) {
  if (!header || typeof header !== 'object') return '';
  const parts = [
    trim(header.Tipo),
    trim(header.Cosecha),
    trim(header.Semana),
    trim(header.Forza),
    trim(header.Lote),
    trim(header.Parcela),
    trim(header.Poblacion),
    trim(header.PtasEstac),
    trim(header.PtasMues),
    trim(header.Area),
    trim(header.GF),
  ];
  return parts.join('|');
}

let restoreSeq = 0;

function normalizeDetalleRow(row) {
  if (!row || typeof row !== 'object') return null;
  const tipoLinea = trim(row.tipoLinea);
  const codigoClasificacion = trim(row.codigoClasificacion);
  const cantidadDelta = Number(row.cantidadDelta);
  if (!tipoLinea || !codigoClasificacion || !Number.isFinite(cantidadDelta)) {
    return null;
  }
  restoreSeq += 1;
  const id =
    trim(row.id) || `restored-${Date.now()}-${restoreSeq}`;
  return {
    id,
    tipoLinea,
    codigoClasificacion,
    cantidadDelta,
    marcaTiempo:
      typeof row.marcaTiempo === 'string' ? row.marcaTiempo : new Date().toISOString(),
  };
}

export function normalizeDetalleForRestore(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeDetalleRow).filter(Boolean);
}

function parseDraft(raw) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.v !== OPERATIONAL_DRAFT_VERSION) return null;
    if (!data.header || typeof data.header !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function loadOperationalDraft() {
  try {
    const localRaw = window.localStorage.getItem(OPERATIONAL_DRAFT_LOCAL_KEY);
    const sessionRaw = window.sessionStorage.getItem(OPERATIONAL_DRAFT_SESSION_KEY);
    const local = parseDraft(localRaw);
    const session = parseDraft(sessionRaw);
    if (!local && !session) return null;
    const localTs = local?.updatedAt ? Date.parse(local.updatedAt) : 0;
    const sessionTs = session?.updatedAt ? Date.parse(session.updatedAt) : 0;
    return localTs >= sessionTs ? local : session;
  } catch {
    return null;
  }
}

/**
 * @param {{ header: object, detalle: Array, activeTab: string }} snapshot
 */
export function saveOperationalDraft({ header, detalle, activeTab }) {
  const fp = getHeaderFingerprint(header);
  const payload = {
    v: OPERATIONAL_DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    headerFingerprint: fp,
    header: { ...header },
    detalle: Array.isArray(detalle) ? detalle : [],
    activeTab: activeTab === 'defects' ? 'defects' : 'sizes',
  };
  const serialized = JSON.stringify(payload);
  try {
    window.localStorage.setItem(OPERATIONAL_DRAFT_LOCAL_KEY, serialized);
  } catch {
    // quota / private mode
  }
  try {
    window.sessionStorage.setItem(OPERATIONAL_DRAFT_SESSION_KEY, serialized);
  } catch {
    // ignore
  }
  try {
    if (header && header.Tipo && header.GF) {
      window.sessionStorage.setItem(
        ESTIMACION_HEADER_STORAGE_KEY,
        JSON.stringify(header)
      );
    }
  } catch {
    // ignore
  }
}

export function clearOperationalDraft() {
  try {
    window.localStorage.removeItem(OPERATIONAL_DRAFT_LOCAL_KEY);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(OPERATIONAL_DRAFT_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function draftHasSamplingProgress(draft) {
  if (!draft || !Array.isArray(draft.detalle)) return false;
  return draft.detalle.length > 0;
}

/**
 * Si la cabecera actual coincide con la del borrador, se puede restaurar detalle.
 */
export function shouldRestoreDetalle(draft, currentHeader) {
  if (!draft || !currentHeader) return false;
  const a = draft.headerFingerprint || getHeaderFingerprint(draft.header);
  const b = getHeaderFingerprint(currentHeader);
  return Boolean(a && b && a === b);
}
