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
import { puedeEditar, PANTALLAS } from '../constants/permissions';

const SESSION_KEY = 'estfruta_session_user';

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

function normalizeHeader(record = {}) {
  return {
    Cosecha: record.Cosecha || record.cosecha || record.pc || '',
    Tipo: record.Tipo || record.tipo || '',
    Semana: record.Semana || record.semana || '',
    Forza: record.Forza || record.forza || '',
    Lote: record.Lote || record.lote || '',
    Parcela: record.Parcela || record.parcela || record.seccion || '',
    Poblacion: record.Poblacion || record.poblacion || '',
    PtasEstac: record.PtasEstac || record.ptasEstac || '',
    PtasMues:
      record.PtasMues || record.PtasMuestras || record.ptasMues || '',
    Area: record.Area || record.area || '',
    GF: record.GF || record.gf || '',
    uniqueKey: record.uniqueKey || record.uniqueId || '',
  };
}

function EstimationSamplingPageTF() {
  const navigate = useNavigate();
  const location = useLocation();
  const estimationId = location.state?.estimationId;
  const isEditLocalMode = location.state?.mode === 'edit-local';
  const [header, setHeader] = useState(() => initialHeaderFromRoute(location));
  const { isOnline, guardarRegistroLocal, actualizarRegistroLocal, registrosLocales } = useOffline();
  const [localEditId, setLocalEditId] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [samplingSaved, setSamplingSaved] = useState(
    () => Boolean(estimationId || (isEditLocalMode && location.state?.localId))
  );

  /*const [tab, setTab] = useState('sizes');*/
  const [submitMessage, setSubmitMessage] = useState('');
  const restoredRef = useRef(false);

  // Resolver rol desde localStorage (este componente no recibe user como prop)
  const resolvedUser = (() => {
    try {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.Usuario && parsed?.Rol ? parsed : null;
    } catch {
      return null;
    }
  })();

  const rol = resolvedUser?.Rol;

  // Roles con CONSULTA_EDICION en EstimacionSamplingPageTF:
  //   Administrador, Supervisor Estimacion, Muestreador.
  // Roles con solo CONSULTA: Supervisor Cosecha, Logistica, Gerente General, Gerente Produccion.
  // Para roles con solo CONSULTA el botón "Crear Registro" queda inhabilitado.
  const canCrearRegistro = puedeEditar(rol, PANTALLAS.ESTIMACION_SAMPLING_TF);
  
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

    // no local connectivity listeners; provider handles it
  }, []);

  useEffect(() => {

    const timer = setTimeout(() => {
      setIsRestoring(false);
    }, 300);

    return () => clearTimeout(timer);

  }, []);

  useEffect(() => {
    const incoming = location.state || {};
    let source = incoming;
    let resolvedLocalId = incoming.localId;

    const incomingUniqueKey =
      incoming.header?.uniqueKey || incoming.uniqueKey || '';

    if (!resolvedLocalId && incomingUniqueKey && incoming.mode === 'edit-local') {
      const recordByKey = registrosLocales.find(
        (r) => r.uniqueKey === incomingUniqueKey
      );
      if (recordByKey) {
        resolvedLocalId = recordByKey.id;
      }
    }

    if (resolvedLocalId) {
      const storedRecord = registrosLocales.find((r) => r.id === resolvedLocalId);
      if (storedRecord) {
        source = storedRecord;
        setLocalEditId(resolvedLocalId);
        if (incoming.mode === 'edit-local') {
          setSamplingSaved(true);
        }
      }
    }

    if (Array.isArray(source.detalle)) {
      replaceDetalle(source.detalle);
    }

    const normalized = normalizeHeader(source);
    if (normalized.Cosecha || normalized.Tipo || normalized.Lote || normalized.GF) {
      if (
        !header ||
        header.uniqueKey !== normalized.uniqueKey ||
        !header.PtasMues
      ) {
        setHeader(normalized);
      }
    }
  }, [location.state, registrosLocales, header]);

  useEffect(() => {

      if (isRestoring) return;

      if (!header)
        navigate('/estimaciones/nueva', {
          replace: true
        });

    }, [header, navigate, isRestoring]);


  // Autosave/restore features removed for simplicity per operational flow.

  const ptasMuestras = header?.PtasMues ?? '';
  const { frutasEmpacables, frutasNoEmpacables, frutasTotales } = aggregates;

  const countsMatch = canCreateEstimationRecord({
    ptasMuestras,
    frutasTotales,
  });

  // canSave: para Muestreador y roles con edición, aplica la regla Total == PtasMues.
  // Para roles con solo Consulta, el botón siempre queda deshabilitado (canCrearRegistro = false).
  const canSave = Boolean(header) && countsMatch && canCrearRegistro;
  

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
    /*alert(
            'payload.id=' + payload.id +
            ' | uniqueKey=' + uniqueKey
          );*/
    

    setSubmitMessage('');
    
    const payload = mergePayload();
    if (!payload) return;
    console.log('PAYLOAD COMPLETO:', payload);
    const uniqueKey =
      header?.uniqueKey ||
      `${payload.Tipo || payload.tipo}-${payload.lote || payload.Lote}-${payload.parcela || payload.Parcela }`;
      console.log('uniqueKey calculado:', uniqueKey);
    if (!isOnline) {
      
      

      // If editing an existing local record, update instead of inserting
      if (localEditId) {
        const changed = actualizarRegistroLocal(localEditId, {
          ...payload,
          uniqueKey,
          estadoSync: 'PENDIENTE_SYNC',
          fechaLocal: new Date().toISOString(),
        });
        if (changed) {
          alert('Registro actualizado localmente');
          clearOperationalDraft();
          setSamplingSaved(true);
          setSubmitMessage('Actualizado local');
          return;
        }
        setSubmitMessage('Error actualizando local');
        return;
      }

      const ok = guardarRegistroLocal({
        ...payload,
        uniqueKey,
      });

      console.log('OK DESPUES DE GUARDAR:', ok);

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
          alert(
            'Debe guardar la Toma Física antes de regresar a Cabecera'
          );
          return;
        }
        // Check if there are unverified local records
        const hasPendingLocal = 
          Array.isArray(registrosLocales) && 
          registrosLocales.some(r => r.verificado !== true);

        if (hasPendingLocal) {
          alert('Debe verificar la Toma Física guardada antes de regresar a Cabecera.');
          return;
        }

        navigate('/estimaciones/nueva', {
          replace: true,
        });
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

  const hasPendingVerification = 
    Array.isArray(registrosLocales) && 
    registrosLocales.some(r => r.verificado !== true);

  const canOpenFolder = Array.isArray(registrosLocales) && registrosLocales.length > 0;

  return (
    <div className="sampling-shell">
      <header className="sampling-shell__header">
        <button
          type="button"
          className="sampling-shell__back"
          onClick={handleVolverCabecera}
          disabled={
            !samplingSaved ||
            hasPendingVerification
          }
          title={
            hasPendingVerification
              ? 'Debe verificar la Toma Física guardada antes de regresar a Cabecera'
              : 'Volver a Cabecera'
          }
          style={{
            cursor:
              !samplingSaved || hasPendingVerification
                ? 'not-allowed'
                : 'pointer',

            opacity:
              !samplingSaved || hasPendingVerification
                ? 0.5
                : 1,
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

          <span
            style={{
              color: isOnline ? '#22c55e' : '#ef4444',
              fontWeight: 600,
            }}
          >
            {isOnline ? 'En línea' : 'Sin línea'}
          </span>
        </div>
        <div className="sampling-shell__context" title={contextLine}>
          {contextLine}
        </div>
        {canOpenFolder && (
            <button
              type="button"
              style={{
                width: 35,
                height: 35,
                border: 'none',
                borderRadius: 10,
                background: '#16a34a',
                color: '#fff',
                fontSize: 20,
                cursor: !samplingSaved ? 'not-allowed' : 'pointer',
                marginLeft: 6, 
                marginRight: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                opacity: !samplingSaved ? 0.5 : 1,
              }}
              onClick={() => {
                if (!samplingSaved) return;
                navigate('/estimaciones/locales');
              }}
              disabled={!samplingSaved}
              title={
                !samplingSaved
                  ? 'Guarda la Toma Física antes de abrir Registros Locales'
                  : 'Registros Locales'
              }
            >
              📂
            </button>
          )}
        
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
        {/* Botón Crear Registro:
            - Muestreador y roles con edición: habilitado solo si Total == PtasMues (canSave).
            - Roles con solo Consulta: siempre deshabilitado (canCrearRegistro = false). */}
        <button
          type="button"
          className="validate-button sampling-footer__primary"
          disabled={!canSave}
          onClick={handleCrearRegistro}
          style={{
            backgroundColor: canSave ? '#16a34a' : '#dc2626',
            color: '#fff',
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
          title={
            !canCrearRegistro
              ? 'No tiene permisos para crear registros.'
              : !countsMatch
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