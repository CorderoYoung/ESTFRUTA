import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../AppTomaFisica.css';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DEFECT_CODES,
  FRUIT_SIZE_CODES,
} from '../constants/sampling';
import {
  canCreateEstimationRecord,
  parseCount,
} from '../domain/estimationBusinessRules';
import { useEstimacionDetalle } from '../hooks/useEstimacionDetalle';
import { clearOperationalDraft } from '../services/operationalDraftStorage';
import { requestCreateEstimation } from '../services/estimationService';
import useOffline from '../hooks/useOffline';
import SamplingCounterTileTomaFisica from '../components/estimation/SamplingCounterTileTomaFisica';

function toApiDetalle(rows) {
  return rows.map(({ tipoLinea, codigoClasificacion, cantidadDelta }) => ({
    tipoLinea,
    codigoClasificacion,
    cantidadDelta,
  }));
}

// Simplified: only accept header passed via navigation state
function initialHeaderFromRoute(routeLocation) {
  return routeLocation.state?.header || null;
}

function EstimationSamplingPageTF() {
  const navigate = useNavigate();
  const location = useLocation();
  const estimationId = location.state?.estimationId;
  const [header] = useState(() => initialHeaderFromRoute(location));
  const { isOnline, guardarRegistroLocal } = useOffline();
  const [isRestoring, setIsRestoring] = useState(false);
  const [samplingSaved, setSamplingSaved] = useState(false);

  /*const [tab, setTab] = useState('sizes');*/
  const [submitMessage, setSubmitMessage] = useState('');
  const restoredRef = useRef(false);
  
      useEffect(() => {

    // no local connectivity listeners; provider handles it
  }, []);

  useEffect(() => {

  const timer = setTimeout(() => {
          setIsRestoring(false);
        }, 300);

        return () => clearTimeout(timer);

      }, []);

  useEffect(() => {

      if (isRestoring) return;

      if (!header)
        navigate('/estimaciones/nueva', {
          replace: true
        });

    }, [header, navigate, isRestoring]);

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

  // Autosave/restore features removed for simplicity per operational flow.

  const ptasMuestras = header?.PtasMues ?? '';
  const { frutasEmpacables, frutasNoEmpacables, frutasTotales } = aggregates;

  const countsMatch = canCreateEstimationRecord({
    ptasMuestras,
    frutasTotales,
  });

  const canSave = Boolean(header) && countsMatch;
  

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
    
    const payload = mergePayload();
    if (!payload) return;
    if (!isOnline) {
      const uniqueKey = `${payload.Tipo || payload.tipo}-${payload.lote || payload.Lote || ''}-${payload.parcela || payload.Parcela || ''}-${Date.now()}`;
      const ok = guardarRegistroLocal({
        ...payload,
        uniqueKey,
      });
      if (ok) {
        alert('Registro guardado localmente');
        clearOperationalDraft();
        setSamplingSaved(true);
        setSubmitMessage('Guardado local');
        return;
      }
      setSubmitMessage('Error guardando local');
      return;
    }

    payload.estimationId = estimationId;
    const result = await requestCreateEstimation(payload);

    if (!result.success) {
      setSubmitMessage(result.errors.join(' '));
      return;
    }

    alert('Toma Física guardada con éxito');
    clearOperationalDraft();
    setSamplingSaved(true);
    setSubmitMessage('Guardado en servidor');
  }

  function handleVolverCabecera() {
    if (!samplingSaved) {
      alert('Debe guardar la Toma Física antes de regresar a Cabecera');
      return;
    }
    navigate('/estimaciones/nueva', { replace: true });
  }

  function handleLimpiarConteos() {
    resetDetalle();
    setSubmitMessage('');
    if (header) {
      // clear any operational draft (we no longer autosave during capture)
      clearOperationalDraft();
    }
  }
  

  const contextLine = useMemo(() => {

      if (!header) return '';

      return `${header.Tipo} · ${header.Cosecha} · ${header.Lote} - ${header.Semana}`;

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
            disabled={!samplingSaved}
            title={
              !samplingSaved
                ? 'Debe guardar la Toma Física antes de regresar a Cabecera'
                : 'Volver a Cabecera'
            }
            style={{
              cursor: samplingSaved
                ? 'pointer'
                : 'not-allowed',

              visibility: samplingSaved
                ? 'visible'
                : 'hidden'
            }}
          >
            Cabecera
          </button>
            
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: '#1a7f37',
            marginLeft: 10,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isOnline
                  ? '#22c55e'
                  : '#ef4444',
              display: 'inline-block',
            }}
          />

          {isOnline ? 'En línea' : 'Sin línea'}
        </div>
        <div className="sampling-shell__context" title={contextLine}>
          {contextLine}
        </div>
        <button
            style={{
              border: 'none',
              borderRadius: 8,
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 18,
              marginLeft: 12,
              cursor: 'pointer',
            }}
            style={{
              cursor: samplingSaved
                ? 'pointer'
                : 'not-allowed',

              visibility: samplingSaved
                ? 'visible'
                : 'hidden'
            }}
            onClick={() => navigate('/estimaciones/locales')}
          >
            🛢️
        </button>
            
        
        
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

      <div
        className="sampling-shell__panel"
        role="tabpanel"
        /*hidden={tab !== 'sizes'}*/
      >
        {/*{tab === 'sizes' ? (*/}
          <div className="sampling-grid-sizes">
            {FRUIT_SIZE_CODES.map((code) => (
              <SamplingCounterTileTomaFisica
                key={code}
                label={code}
                count={countFor(TIPO_LINEA.TAMANO, code)}
                onIncrement={() => increment(TIPO_LINEA.TAMANO, code)}
                onDecrement={() => decrement(TIPO_LINEA.TAMANO, code)}
                className="sampling-tile-size"
              />
            ))}
          </div>
        {/*) : null}*/}
      </div>

      <div
        className="sampling-shell__panel sampling-shell__panel--defects"
        role="tabpanel" 
      >
          <div className="sampling-grid-defects">
            {DEFECT_CODES.map((code) => (
              <SamplingCounterTileTomaFisica
                key={code}
                label={code}
                count={countFor(TIPO_LINEA.DEFECTO, code)}
                onIncrement={() => increment(TIPO_LINEA.DEFECTO, code)}
                onDecrement={() => decrement(TIPO_LINEA.DEFECTO, code)}
                className="sampling-tile-defect"
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
                  !countsMatch
                    ? 'Total debe ser igual a PtasMues.'
                    : ''
                }
          
        >
          Crear Registro
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

export default EstimationSamplingPageTF;
