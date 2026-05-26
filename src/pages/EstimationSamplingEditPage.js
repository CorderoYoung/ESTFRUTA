import '../AppConsultaEdicion.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  DEFECT_CODES,
  FRUIT_SIZE_CODES,
} from '../constants/sampling';
import {
      doc,
      getDoc,
      updateDoc,
      deleteDoc,
    } from 'firebase/firestore';
import { deriveGf } from '../domain/estimationBusinessRules';
import { db } from '../firebaseConfig.js';
import { ESTIMACION_HEADER_STORAGE_KEY } from '../constants/estimationContext';
import {
  canCreateEstimationRecord,
  parseCount,
} from '../domain/estimationBusinessRules';
import SamplingCounterTileConsultaEdicion from '../components/estimation/SamplingCounterTileConsultaEdicion';
import { useEstimacionDetalle } from '../hooks/useEstimacionDetalle';
import { useDebouncedEffect } from '../hooks/useDebouncedEffect';
import {
  clearOperationalDraft,
  loadOperationalDraft,
  saveOperationalDraft,
  shouldRestoreDetalle,
} from '../services/operationalDraftStorage';
import { requestCreateEstimation, requestUpdateEstimation } from '../services/estimationService';

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
    if (parsed && parsed.Tipo && (parsed.GF || parsed.gf)) return parsed;
  } catch {
    // ignore
  }
  return null;
}

// PHASE 2: Load from route or Firebase, not from drafts
function initialHeaderFromRoute(location) {
  if (location.state?.header) return location.state.header;
  // PHASE 2: Draft loading disabled
  // const draft = loadOperationalDraft();
  // if (draft?.header?.gf || draft?.header?.GF) return draft.header;
  // Fallback to sessionStorage (will be removed in Phase 4)
  return readStoredHeader();
}

function EstimationSamplingEditPage() { 
  const { id } = useParams(); 
  const navigate = useNavigate(); 
  const location = useLocation();
  const [header, setHeader] = useState(null);
  console.log('HEADER TF', header);
  const [editMode, setEditMode] = useState(false);

  const handleSave = async () => {

    try {

      const payload = {
        ...header,
        detalle,
        actualizadoEn: new Date(),
        GF: header?.GF || deriveGf(header?.Forza ?? header?.forza, header?.Semana ?? header?.semana) || '',
      };

      console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(payload, null, 2));
      console.log('GF MINUSCULA:', payload.gf);

      const finalPayload = { ...payload };
      if ('gf' in finalPayload) {
        delete finalPayload.gf;
      }
      console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(finalPayload, null, 2));

      await updateDoc(doc(db, 'estimaciones', id), finalPayload);

          alert('Cambios guardados');

        } catch (error) {

          console.error(error);

          alert('Error al guardar');

        }

      };
    
  const handleDelete = async () => {
    console.log('handleDelete invoked');
    console.log('handleDelete id:', id);

    const confirmar = window.confirm('¿Está seguro de eliminar este registro?');
    if (!confirmar) {
      console.log('handleDelete: user cancelled');
      return;
    }
    console.log('handleDelete: user confirmed');

    try {
      const reference = doc(db, 'estimaciones', id);
      console.log('handleDelete: deleting doc ref', reference);
      await deleteDoc(reference);
      console.log('handleDelete: deletion successful for id', id);
      alert('Registro eliminado');
      navigate('/consulta-est-fruta');
    } catch (error) {
      console.error('handleDelete: error deleting document', error);
      alert('Error al eliminar: ' + (error?.message || String(error)));
    }
  };

  /*const [tab, setTab] = useState('sizes');*/
  const [submitMessage, setSubmitMessage] = useState('');
  const restoredRef = useRef(false);

  const cargarRegistroFirebase = async () => {

    try {

      console.log('ID recibido:', id);

      const ref = doc(db, 'estimaciones', id);

      const snapshot = await getDoc(ref);

      if (snapshot.exists()) {

        const data = snapshot.data();

        setHeader({
          Cosecha: data.Cosecha || '',
          Tipo: data.Tipo || '',
          Semana: data.Semana || '',
          Forza: data.Forza || '',
          Lote: data.Lote || '',
          Parcela: data.Parcela || '',
          Poblacion: data.Poblacion || '',
          PtasEstac: data.PtasEstac || '',
          PtasMues: data.PtasMues || '',
          Area: data.Area || '',
          GF: data.GF || '',
        });

        
        console.log("DATA COMPLETA:", data);

        if (Array.isArray(data?.detalle)) {
          replaceDetalle(data.detalle);
        }
      } else {

        console.log('No existe registro');

      }

    } catch (error) {

      console.error('ERROR FIREBASE:', error);
      alert(error.message);
    }

  };

  useEffect(() => {
    if (!id) {
      navigate('/estimaciones/nueva', { replace: true });
      return;
    }
    cargarRegistroFirebase();
  }, [id, navigate]);

  const {
    detalle,
    aggregates,
    increment,
    decrement,
    countFor,
    setCountFor,
    resetDetalle,
    replaceDetalle,
    TIPO_LINEA,
  } = useEstimacionDetalle();

  const handleCountChange = (
    tipoLinea,
    codigoClasificacion,
    nuevoValor
  ) => {
    const value = Number(nuevoValor);
    const cantidad = Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;

    console.log('handleCountChange:', {
      tipoLinea,
      codigoClasificacion,
      nuevoValor,
      value,
      cantidad,
      editMode,
    });

    setCountFor(tipoLinea, codigoClasificacion, cantidad);
  };

  const persistDraft = useCallback(() => {
    if (!header || typeof header !== 'object') return;
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
      // Defensive destructuring: avoid crash if `aggregates` is unexpectedly undefined
      let safeFrutasEmpacables = 0;
      let safeFrutasNoEmpacables = 0;
      let safeFrutasTotales = 0;
  const renderErrorRef = useRef(null);
      try {
        if (aggregates && typeof aggregates === 'object') {
          safeFrutasEmpacables = Number(aggregates.frutasEmpacables) || 0;
          safeFrutasNoEmpacables = Number(aggregates.frutasNoEmpacables) || 0;
          safeFrutasTotales = Number(aggregates.frutasTotales) || 0;
        } else {
          throw new Error('aggregates is not an object');
        }
      } catch (err) {
        renderErrorRef.current = err;
      }
  const PtasMuest = header?.PtasMues;
  const headerGf = header?.GF;

  const countsMatch = canCreateEstimationRecord({
      PtasMuest,
      frutasTotales: safeFrutasTotales,
        });
  // Allow saving even if GF is not present (backwards-compatible)
  const canSave = Boolean(header) && countsMatch;

  const ptasParsed = parseCount(PtasMuest);

  const showMismatchHint =
        ptasParsed !== null && !countsMatch;
  
  

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

    // PHASE 3: Use UPDATE if editing existing document, CREATE if new
  const result = id
      ? await requestUpdateEstimation(id, payload)
      : await requestCreateEstimation(payload);

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
    return `${header.Tipo} · ${header.Cosecha} · ${header.Lote} - ${header.Semana}`;
  }, [header]);

  if (!header) {
    return null;
  }

  if (renderErrorRef.current) {
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h2>Debug: render error</h2>
        <pre>
        {JSON.stringify(renderErrorRef.current, null, 2)}
      </pre>
      </div>
    );
  }

  return (
    <div className="sampling-shell">
      <header className="sampling-shell__header">
        <button
          className="sampling-back-button"
          onClick={() => navigate('/consulta-est-fruta')}
        >
          ⬅ 
        </button>
        <div className="sampling-shell__context" title={contextLine}>
          {contextLine}
        </div>
        <button
            type="button"
            className="sampling-save-button"
            onClick={handleSave}
          >
            💾
          </button>
      </header>

      <div className="consulta-footer-actions">

        <button
          type="button"
          className="consulta-footer-btn consulta-footer-delete"
          onClick={handleDelete}
        >
          🗑️
        </button>

        <button
          className="consulta-footer-btn consulta-footer-edit"
          onClick={() => setEditMode(true)}
        >
          🖊
        </button>

      </div>
      
      <p className="sampling-autosave-hint" aria-live="polite">
        Consulta / Edición  
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
        
      >
        

        <div className="sampling-header-section">

  <div className="sampling-header-grid sampling-header-grid--top">

    <div className="sampling-header-item">
      <span className="sampling-header-label">Cosec</span>
      {editMode ? (
        <input
          className="sampling-tile-readonly__input"
          value={header?.Cosecha || ''}
          onChange={(e) =>
            setHeader({
              ...header,
              Cosecha: e.target.value,
            })
          }
        />
      ) : (
      <span className="sampling-header-value">
        {header?.Cosecha}
      </span>
      )}
    </div>

    <div className="sampling-header-item">
      <span className="sampling-header-label">Tipo</span>
      {editMode ? (
        <input
          className="sampling-tile-readonly__input"
          value={header?.Tipo || ''}
          onChange={(e) =>
            setHeader({
              ...header,
              Tipo: e.target.value,
            })
          }
        />
      ) : (
      <span className="sampling-header-value">
        {header?.Tipo}
      </span>
      )}
    </div>

    <div className="sampling-header-item">
      <span className="sampling-header-label">Sem</span>

      {editMode ? (
        <input
          className="sampling-tile-readonly__input"
          value={header?.Semana || ''}
          onChange={(e) =>
            setHeader({
              ...header,
              Semana: e.target.value,
            })
          }
        />
      ) : (
      <span className="sampling-header-value">
        {header?.Semana}
      </span>
      )}
    </div>

    <div className="sampling-header-item">
      <span className="sampling-header-label">Forza</span>

      {editMode ? (
      <input
        className="sampling-tile-readonly__input"
        value={header?.Forza || ''}
        onChange={(e) =>
          setHeader({
            ...header,
            Forza: e.target.value,
          })
        }
      />
    ) : (
      <span className="sampling-header-value">
        {header?.Forza}
      </span>
      )}
    </div>

    <div className="sampling-header-item">
      <span className="sampling-header-label">Lote</span>

      {editMode ? (
        <input
          className="sampling-tile-readonly__input"
          value={header?.Lote || ''}
          onChange={(e) =>
            setHeader({
              ...header,
              Lote: e.target.value,
            })
          }
        />
      ) : (
      <span className="sampling-header-value">
        {header?.Lote}
      </span>
      )}
    </div>

    <div className="sampling-header-item">
      <span className="sampling-header-label">Parc</span>
      {editMode ? (
        <input
          className="sampling-tile-readonly__input"
          value={header?.Parcela || ''}
          onChange={(e) =>
            setHeader({
              ...header,
              Parcela: e.target.value,
            })
          }
        />
      ) : (
      <span className="sampling-header-value">
        {header?.Parcela}
      </span>
      )}
    </div>

  </div>

  <div className="sampling-header-grid sampling-header-grid--bottom">

    <div className="sampling-header-item">
      <span className="sampling-header-label">Pobl</span>{editMode ? (
      <input
        className="sampling-tile-readonly__input"
        value={header?.Poblacion || ''}
        onChange={(e) =>
          setHeader({
            ...header,
            Poblacion: e.target.value,
          })
        }
      />
    ) : (
      <span className="sampling-header-value">
        {header?.Poblacion}
      </span>
      )}
    </div>

    <div className="sampling-header-item">
      <span className="sampling-header-label">PtasEst</span>
      {editMode ? (
      <input
        className="sampling-tile-readonly__input"
        value={header?.PtasEstac || ''}
        onChange={(e) =>
          setHeader({
            ...header,
            PtasEstac: e.target.value,
          })
        }
      />
    ) : (
      <span className="sampling-header-value">
        {header?.PtasEstac}
      </span>
      )}
    </div>

    <div className="sampling-header-item">
      <span className="sampling-header-label">PtMue</span>
      {editMode ? (
        <input
          className="sampling-tile-readonly__input"
          value={header?.PtasMues || ''}
          onChange={(e) =>
            setHeader({
              ...header,
              PtasMues: e.target.value,
            })
          }
        />
      ) : (
      <span className="sampling-header-value">
        {header?.PtasMues}
      </span>
      )}
    </div>

    <div className="sampling-header-item">
      <span className="sampling-header-label">Área</span>
      {editMode ? (
      <input
        className="sampling-tile-readonly__input"
        value={header?.Area || ''}
        onChange={(e) =>
          setHeader({
            ...header,
            Area: e.target.value,
          })
        }
      />
    ) : (
      <span className="sampling-header-value">
        {header?.Area}
      </span>
      )}
    </div>

    <div className="sampling-header-item">
      <span className="sampling-header-label">GF</span>

      {editMode ? (
        <input
          className="sampling-tile-readonly__input"
          value={header?.GF || ''}
          onChange={(e) =>
            setHeader({
              ...header,
              GF: e.target.value,
            })
          }
        />
      ) : (
        <span className="sampling-header-value">
          {header?.GF}
        </span>
      )}
    </div>

  </div>

</div>

      <hr className="sampling-divider" />

          <div className="sampling-grid-sizes">
            {FRUIT_SIZE_CODES.map((code) => (
            <SamplingCounterTileConsultaEdicion
              key={code}
              label={code}
              count={countFor(TIPO_LINEA.TAMANO, code)}
              className="sampling-tile-readonly-size"
              editMode={editMode}

              onChange={(value) =>
                handleCountChange(
                  TIPO_LINEA.TAMANO,
                  code,
                  value
                )
              }
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
              <SamplingCounterTileConsultaEdicion
                key={code}
                label={code}
                count={countFor(TIPO_LINEA.DEFECTO, code)}
                className="sampling-tile-readonly-defect"
                editMode={editMode}

                onChange={(value) =>
                  handleCountChange(
                    TIPO_LINEA.DEFECTO,
                    code,
                    value
                  )
                }
              />
            ))}
          </div>
        
      </div>

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

export default EstimationSamplingEditPage;
