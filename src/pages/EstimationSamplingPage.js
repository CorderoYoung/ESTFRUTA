import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DEFECT_CODES,
  FRUIT_SIZE_CODES,
} from '../constants/sampling';
import { ESTIMACION_HEADER_STORAGE_KEY } from '../constants/estimationContext';
import {
  canCreateEstimationRecord,
  parseCount,
} from '../domain/estimationBusinessRules';
import SamplingCounterTile from '../components/estimation/SamplingCounterTile';
import { useEstimacionDetalle } from '../hooks/useEstimacionDetalle';
import { useDebouncedEffect } from '../hooks/useDebouncedEffect';
import {
  clearOperationalDraft,
  loadOperationalDraft,
  saveOperationalDraft,
  shouldRestoreDetalle,
} from '../services/operationalDraftStorage';
import { requestCreateEstimation } from '../services/estimationService';

function toApiDetalle(rows) {
  return rows.map(({ tipoLinea, codigoClasificacion, cantidadDelta }) => ({
    tipoLinea,
    codigoClasificacion,
    cantidadDelta,
  }));
}

function readStoredHeader() {
  try {
    const raw = window.sessionStorage.getItem(ESTIMACION_HEADER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.Tipo && parsed.GF) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function initialHeaderFromRoute(location) {
  if (location.state?.header) return location.state.header;
  const draft = loadOperationalDraft();
  if (draft?.header?.GF) return draft.header;
  return readStoredHeader();
}

function EstimationSamplingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [header] = useState(() => initialHeaderFromRoute(location));
  /*const [tab, setTab] = useState('sizes');*/
  const [submitMessage, setSubmitMessage] = useState('');
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!header) navigate('/estimaciones/nueva', { replace: true });
  }, [header, navigate]);

  const {
    detalle,
    aggregates,
    increment,
    decrement,
    countFor,
    resetDetalle,
    replaceDetalle,
    TIPO_LINEA,
  } = useEstimacionDetalle();

  useEffect(() => {
    if (!header || restoredRef.current) return;
    restoredRef.current = true;
    const draft = loadOperationalDraft();
    if (shouldRestoreDetalle(draft, header)) {
      replaceDetalle(draft.detalle);
      /*setTab(draft.activeTab === 'defects' ? 'defects' : 'sizes');*/
    }
  }, [header, replaceDetalle]);

  const persistDraft = useCallback(() => {
    if (!header) return;
    saveOperationalDraft({ header, detalle });
  }, [header, detalle, /* tab */]);

  useDebouncedEffect(
    () => {
      persistDraft();
    },
    [header, detalle, ],
    280
  );

  useEffect(() => {
    function flush() {
      persistDraft();
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') flush();
    }
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [persistDraft]);

  const ptasMuestras = header?.PtasMues ?? '';
  const { frutasEmpacables, frutasNoEmpacables, frutasTotales } = aggregates;

  const countsMatch = canCreateEstimationRecord({
    ptasMuestras,
    frutasTotales,
  });

  const gfOk = Boolean(header?.GF);
  const canSave = Boolean(header) && gfOk && countsMatch;

  const ptasParsed = parseCount(ptasMuestras);
  const showMismatchHint = ptasParsed !== null && !countsMatch;

  const mergePayload = useCallback(() => {
    if (!header) return null;
    return {
      ...header,
      PtasMuestras: header.PtasMues,
      detalle: toApiDetalle(detalle),
    };
  }, [header, detalle]);

  async function handleCrearRegistro() {
    setSubmitMessage('');
    persistDraft();
    const payload = mergePayload();
    if (!payload) return;
    const result = await requestCreateEstimation(payload);
    if (!result.success) {
      setSubmitMessage(result.errors.join(' '));
      return;
    }
    clearOperationalDraft();
    try {
      window.sessionStorage.removeItem(ESTIMACION_HEADER_STORAGE_KEY);
    } catch {
      // ignore
    }
    setSubmitMessage('Validacion correcta (demo). Listo para API.');
  }

  function handleVolverCabecera() {
    persistDraft();
    navigate('/estimaciones/nueva', { replace: true });
  }

  function handleLimpiarConteos() {
    resetDetalle();
    setSubmitMessage('');
    if (header) {
      saveOperationalDraft({ header, detalle: [],  });
    }
  }

  const contextLine = useMemo(() => {
    if (!header) return '';
    return `${header.Tipo} · ${header.Cosecha} · GF ${header.GF}`;
  }, [header]);

  if (!header) {
    return null;
  }

  return (
    <div className="sampling-shell">
      <header className="sampling-shell__header">
        <button
          type="button"
          className="sampling-shell__back"
          onClick={handleVolverCabecera}
        >
          Cabecera
        </button>
        <div className="sampling-shell__context" title={contextLine}>
          {contextLine}
        </div>
      </header>

      <p className="sampling-autosave-hint" aria-live="polite">
        Toma Fisica  
      </p>

      <div className="sampling-shell__metrics" aria-live="polite">
        <div className="sampling-metric">
          <span className="sampling-metric__label">Empac.</span>
          <span className="sampling-metric__value">{frutasEmpacables}</span>
        </div>
        <div className="sampling-metric">
          <span className="sampling-metric__label">No Empac.</span>
          <span className="sampling-metric__value">{frutasNoEmpacables}</span>
        </div>
        <div className="sampling-metric sampling-metric--accent">
          <span className="sampling-metric__label">Total</span>
          <span className="sampling-metric__value">{frutasTotales}</span>
        </div>
        <div className="sampling-metric sampling-metric--target">
          <span className="sampling-metric__label">Muestra</span>
          <span className="sampling-metric__value">{ptasMuestras || '—'}</span>
        </div>
      </div>

      {showMismatchHint ? (
        <p className="sampling-shell__hint sampling-shell__hint--error" role="alert">
          Total debe igualar PtasMues ({ptasMuestras}).
        </p>
      ) : null}

      {/*<div className="sampling-tabs" role="tablist" aria-label="Tipo de conteo"> 
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sizes'}
          className={tab === 'sizes' ? 'sampling-tab is-active' : 'sampling-tab'}
          onClick={() => setTab('sizes')}
        >
          Tamanos 5-12
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'defects'}
          className={
            tab === 'defects' ? 'sampling-tab is-active' : 'sampling-tab'
          }
          onClick={() => setTab('defects')}
        >
          Defectos
        </button>
      </div> */}

      <div
        className="sampling-shell__panel"
        role="tabpanel"
        /*hidden={tab !== 'sizes'}*/
      >
        {/*{tab === 'sizes' ? (*/}
          <div className="sampling-grid-sizes">
            {FRUIT_SIZE_CODES.map((code) => (
              <SamplingCounterTile
                key={code}
                label={code}
                count={countFor(TIPO_LINEA.TAMANO, code)}
                onIncrement={() => increment(TIPO_LINEA.TAMANO, code)}
                onDecrement={() => decrement(TIPO_LINEA.TAMANO, code)}
              />
            ))}
          </div>
        {/*) : null}*/}
      </div>

      <div
        className="sampling-shell__panel sampling-shell__panel--defects"
        role="tabpanel"
        /* hidden={tab !== 'defects'} */
      >
        {/* {tab === 'defects' ? ( */}
          <div className="sampling-grid-defects">
            {DEFECT_CODES.map((code) => (
              <SamplingCounterTile
                key={code}
                label={code}
                variant="compact"
                count={countFor(TIPO_LINEA.DEFECTO, code)}
                onIncrement={() => increment(TIPO_LINEA.DEFECTO, code)}
                onDecrement={() => decrement(TIPO_LINEA.DEFECTO, code)}
              />
            ))}
          </div>
        {/* ) : null} */}
      </div>

      <footer className="sampling-shell__footer">
        <button
          type="button"
          className="validate-button sampling-footer__primary"
          disabled={!canSave}
          onClick={handleCrearRegistro}
          title={
            !gfOk
              ? 'Cabecera invalida.'
              : !countsMatch
                ? 'Total debe ser igual a PtasMues.'
                : ''
          }
        >
          Crear Registro
        </button>
        <button
          type="button"
          className="sampling-footer__secondary"
          onClick={handleLimpiarConteos}
        >
          Limpiar conteos
        </button>
      </footer>

      {submitMessage ? (
        <p
          className={
            submitMessage.includes('demo')
              ? 'sampling-toast sampling-toast--ok'
              : 'sampling-toast sampling-toast--err'
          }
        >
          {submitMessage}
        </p>
      ) : null}
    </div>
  );
}

export default EstimationSamplingPage;
