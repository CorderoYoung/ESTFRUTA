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
import { ROLES } from '../constants/roles';

// ─────────────────────────────────────────────
// Constante de clave de sesión (igual que en el resto de la app)
// ─────────────────────────────────────────────
const SESSION_KEY = 'estfruta_session_user';

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
 
function normalizeFirebaseHeader(data) {
  if (!data || typeof data !== 'object') return null;
  const ptasMuesValue =
    data.PtasMues ?? data.PtasMuestras ?? data.ptasMues ?? data.ptasMues ?? '';
 
  return {
    Cosecha: data.Cosecha || data.cosecha || data.pc || '',
    Tipo: data.Tipo || data.tipo || '',
    Semana: data.Semana || data.semana || '',
    Forza: data.Forza || data.forza || '',
    Lote: data.Lote || data.lote || '',
    Parcela: data.Parcela || data.parcela || data.seccion || '',
    Poblacion: data.Poblacion || data.poblacion || '',
    PtasEstac: data.PtasEstac || data.ptasEstac || '',
    PtasMues: ptasMuesValue,
    Area: data.Area || data.area || '',
    GF:
      data.GF || data.gf ||
      deriveGf(data.Forza ?? data.forza, data.Semana ?? data.semana) || '',
  };
}
 
// PHASE 2: Load from route or Firebase, not from drafts
function initialHeaderFromRoute(location) {
  if (location.state?.header) return location.state.header;
  return readStoredHeader();
}
 
function EstimationSamplingEditPage({ user }) { 
  const { id } = useParams(); 
  const navigate = useNavigate(); 
  const location = useLocation();
  const [header, setHeader] = useState(null);
        console.log('HEADER TF', header);

  // ─────────────────────────────────────────────
  // Resolver rol: prop user tiene prioridad; si no llega, leer localStorage
  // ─────────────────────────────────────────────
  const resolvedUser = user ?? (() => {
    try {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.Usuario && parsed?.Rol ? parsed : null;
    } catch {
      return null;
    }
  })();

  const rol = resolvedUser?.Rol?.trim();

  /**
   * Solo Supervisor Estimacion puede editar, guardar, eliminar y aprobar.
   * Todos los demás roles solo pueden consultar (botón Volver habilitado).
   */
  const isSupervisorEstimacion = rol === ROLES.SUPERVISOR_ESTIMACION;

  // Estado de modo edición: empieza en false; solo Supervisor Estimacion puede activarlo.
  const [isEditing, setIsEditing] = useState(false);

  // Estado de aprobación local: se inicializa desde Firebase al cargar el registro.
  // Refleja el campo `verificado` del documento.
  const [isVerificado, setIsVerificado] = useState(false);

  // ─────────────────────────────────────────────
  // handleSave: bloqueado si no es Supervisor Estimacion o no está en modo edición.
  // Valida que Total == PtasMues antes de guardar.
  // ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!isSupervisorEstimacion || !isEditing) return;

    // Validación: Total debe ser igual a PtasMues
    // Se usa comparación numérica directa como doble seguro,
    // independientemente de lo que devuelva canCreateEstimationRecord.
    const ptasMuesNum = Number(header?.PtasMues) || 0;
    if (safeFrutasTotales !== ptasMuesNum) {
      alert(
        `El Total de Muestras (${safeFrutasTotales}) debe ser igual a las Plantas Muestreadas (${ptasMuesNum}). Corrija los conteos antes de guardar.`
      );
      return;
    }

    try {
      const payload = {
        ...header,
        detalle,
        actualizadoEn: new Date(),
        GF:
          header?.GF ||
          deriveGf(
            header?.Forza ?? header?.forza,
            header?.Semana ?? header?.semana
          ) || '',
      };
 
      console.log(
        'PAYLOAD FINAL FIREBASE',
        JSON.stringify(payload, null, 2)
      );
 
      console.log('GF MINUSCULA:', payload.gf);
 
      const finalPayload = { ...payload };
 
      if ('gf' in finalPayload) {
        delete finalPayload.gf;
      }
 
      console.log(
        'PAYLOAD FINAL FIREBASE',
        JSON.stringify(finalPayload, null, 2)
      );
 
      await updateDoc(
        doc(db, 'estimaciones', id),
        finalPayload
      );
 
      // Guarda ID del registro salvado
      sessionStorage.setItem('savedSamplingId', id);
 
      alert('Cambios guardados');
 
    } catch (error) {
      console.error(error);
      alert('Error al guardar');
    }
  };

  // ─────────────────────────────────────────────
  // handleAprobar: escribe verificado:true en Firebase.
  // Solo disponible para Supervisor Estimacion cuando Total == PtasMues.
  // ─────────────────────────────────────────────
  const handleAprobar = async () => {
    if (!isSupervisorEstimacion) return;

    // Validación: no se puede aprobar si Total != PtasMues
    // Se usa comparación numérica directa como doble seguro.
    const ptasMuesNumApr = Number(header?.PtasMues) || 0;
    if (safeFrutasTotales !== ptasMuesNumApr) {
      alert(
        `No se puede aprobar. El Total de Muestras (${safeFrutasTotales}) debe ser igual a las Plantas Muestreadas (${ptasMuesNumApr}).`
      );
      return;
    }

    try {
      await updateDoc(doc(db, 'estimaciones', id), {
        verificado: true,
        aprobadoPor: resolvedUser?.Usuario ?? 'Supervisor',
        aprobadoEn: new Date(),
      });

      setIsVerificado(true);
      alert('Registro aprobado correctamente.');
      navigate('/estimaciones');
    } catch (error) {
      console.error('Error al aprobar:', error);
      alert('Error al aprobar el registro: ' + (error?.message || String(error)));
    }
  };

  // ─────────────────────────────────────────────
  // handleDelete: ANULA el registro (borrado logico).
  // Bloqueado si no es Supervisor Estimacion o no esta en modo edicion.
  // ─────────────────────────────────────────────
  const handleDelete = async () => {
    if (!isSupervisorEstimacion || !isEditing) return;

    console.log('handleDelete invoked');
    console.log('handleDelete id:', id);
 
    const confirmar = window.confirm(
      '¿Anular este registro? Dejara de aparecer en consultas y analisis, pero se conserva en la base para auditoria.'
    );
    if (!confirmar) {
      console.log('handleDelete: user cancelled');
      return;
    }
    console.log('handleDelete: user confirmed');
 
    try {
      // 2026-11-07: borrado logico. firestore.rules tiene allow delete: if false
      // (intencional, para no perder trazabilidad de quien capturo cada muestreo),
      // por lo que deleteDoc siempre fallaba con "Missing or insufficient
      // permissions". En su lugar se marca el registro como anulado; las pantallas
      // de consulta y analisis lo excluyen y el documento queda para auditoria.
      await updateDoc(doc(db, 'estimaciones', id), {
        anulado: true,
        anuladoPor: resolvedUser?.Usuario ?? 'Supervisor',
        anuladoEn: new Date(),
      });
      console.log('handleDelete: registro anulado', id);
      alert('Registro anulado');
      navigate('/estimaciones');
    } catch (error) {
      console.error('handleDelete: error anulando documento', error);
      alert('Error al anular: ' + (error?.message || String(error)));
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
        setHeader(normalizeFirebaseHeader(data));
        console.log("DATA COMPLETA:", data);

        // Leer el campo verificado existente en Firebase
        setIsVerificado(data.verificado === true);
 
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
      isEditing,
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
  // Normalizar a número para evitar comparación string vs number
  // (cuando el Supervisor edita el campo PtMue desde un <input>, el valor
  // llega como string; safeFrutasTotales siempre es number).
  const PtasMuest = Number(header?.PtasMues) || 0;
  const headerGf = header?.GF;
 
  const countsMatch = canCreateEstimationRecord({
      // 2026-11-07: el parametro se llama ptasMuestras en canCreateEstimationRecord.
      // Antes se pasaba como "PtasMuest", asi que llegaba undefined y countsMatch
      // era SIEMPRE false: el boton Aprobar quedaba deshabilitado para todos los
      // registros y ningun muestreo podia verificarse por la via correcta.
      ptasMuestras: PtasMuest,
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
    return `${header.Cosecha} - ${header.Lote} - ${header.Parcela} - ${header.Area}`;
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
        {/* ── Botón Volver: siempre habilitado para todos los roles.
              Solo navega hacia atras. NO marca el registro como verificado.
              2026-11-07: aqui habia un updateDoc que escribia verificado:true, sin
              control de rol, de modo que cualquier usuario (Muestreador incluido)
              daba por verificado un muestreo con solo salir de la pantalla, sin
              validar Total == PtasMues y sin dejar constancia de quien aprobo.
              La verificacion es exclusiva del Supervisor Estimacion, mediante el
              boton Aprobar, que si valida y escribe aprobadoPor/aprobadoEn. ── */}
        <button
          className="sampling-back-button"
          onClick={() => navigate(-1)}
        >
          ⬅ 
        </button>
        <div className="sampling-shell__context" title={contextLine}>
          {contextLine}
        </div>

        {/* ── Botón Salvar (💾):
              Visible solo para Supervisor Estimacion.
              Habilitado solo cuando isSupervisorEstimacion && isEditing.
              Si Total != PtasMues, muestra alerta y no guarda. ── */}
        {isSupervisorEstimacion && (
          <button
            type="button"
            className="sampling-save-button"
            onClick={handleSave}
            disabled={!isEditing}
            title={
              !isEditing
                ? 'Active el modo edición con el lápiz para guardar'
                : !countsMatch
                ? 'Total debe ser igual a PtasMues para guardar'
                : 'Guardar cambios'
            }
            style={{
              opacity: !isEditing ? 0.4 : 1,
              cursor: !isEditing ? 'not-allowed' : 'pointer',
            }}
          >
            💾
          </button>
        )}

        {/* ── Botón Aprobar (✅):
              Visible solo para Supervisor Estimacion.
              Habilitado solo cuando countsMatch (Total == PtasMues).
              Escribe verificado:true en Firebase y navega a /estimaciones. ── */}
        {isSupervisorEstimacion && (
          <button
            type="button"
            onClick={handleAprobar}
            disabled={!countsMatch}
            title={
              !countsMatch
                ? 'Total debe ser igual a PtasMues para aprobar'
                : isVerificado
                ? 'Este registro ya fue aprobado'
                : 'Aprobar registro'
            }
            style={{
              width: 34,
              height: 34,
              border: 'none',
              borderRadius: 8,
              background: isVerificado ? '#166534' : countsMatch ? '#16a34a' : '#6b7280',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !countsMatch ? 'not-allowed' : 'pointer',
              opacity: !countsMatch ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            ✓
          </button>
        )}
      </header>
 
      <div className="consulta-footer-actions">

        {/* ── Botón Eliminar (🗑️):
              Visible solo para Supervisor Estimacion.
              Habilitado solo cuando isSupervisorEstimacion && isEditing. ── */}
        {isSupervisorEstimacion && (
          <button
            type="button"
            className="consulta-footer-btn consulta-footer-delete"
            onClick={handleDelete}
            disabled={!isEditing}
            title={
              !isEditing
                ? 'Active el modo edición con el lápiz para eliminar'
                : 'Eliminar registro'
            }
            style={{
              opacity: !isEditing ? 0.4 : 1,
              cursor: !isEditing ? 'not-allowed' : 'pointer',
            }}
          >
            🗑️
          </button>
        )}

        {/* ── Botón Lápiz Editar (✏️):
              Visible solo para Supervisor Estimacion.
              Al hacer clic activa isEditing = true. ── */}
        {isSupervisorEstimacion && (
          <button
            className="consulta-footer-btn consulta-footer-edit"
            onClick={() => setIsEditing(true)}
            title={
              isEditing
                ? 'Modo edición activo'
                : 'Activar modo edición'
            }
            style={{
              opacity: isEditing ? 0.5 : 1,
              cursor: isEditing ? 'default' : 'pointer',
            }}
          >
            ✏️
          </button>
        )}

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
      {/* Los inputs de edición de campos del header solo se muestran
          cuando isSupervisorEstimacion && isEditing */}
      {isSupervisorEstimacion && isEditing ? (
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
      {isSupervisorEstimacion && isEditing ? (
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
 
      {isSupervisorEstimacion && isEditing ? (
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
 
      {isSupervisorEstimacion && isEditing ? (
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
 
      {isSupervisorEstimacion && isEditing ? (
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
      {isSupervisorEstimacion && isEditing ? (
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
      <span className="sampling-header-label">Pobl</span>
      {isSupervisorEstimacion && isEditing ? (
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
      {isSupervisorEstimacion && isEditing ? (
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
      {isSupervisorEstimacion && isEditing ? (
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
      {isSupervisorEstimacion && isEditing ? (
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
 
      {isSupervisorEstimacion && isEditing ? (
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
              // Los contadores son editables solo para Supervisor Estimacion en modo edición
              editMode={isSupervisorEstimacion && isEditing}
 
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
                // Los contadores son editables solo para Supervisor Estimacion en modo edición
                editMode={isSupervisorEstimacion && isEditing}
 
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