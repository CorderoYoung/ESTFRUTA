import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { crearUniqueKey } from '../services/operationalDraftStorage';
import useOffline from '../hooks/useOffline';
import { puedeEditar, PANTALLAS } from '../constants/permissions';

const SESSION_KEY = 'estfruta_session_user';

function PantallaDatosGuardadosCelular() {
  const { isOnline, registrosLocales = [], syncRegistro, eliminarRegistroLocal, actualizarRegistroLocal } = useOffline();
  const navigate = useNavigate();

  const registros = useMemo(() => registrosLocales || [], [registrosLocales]);

  const [duplicadosDetectados, setDuplicadosDetectados] = useState({});

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

  // Roles con CONSULTA_EDICION: Administrador, Supervisor Estimacion, Muestreador.
  // Roles con solo CONSULTA: Supervisor Cosecha, Logistica, Gerente General, Gerente Produccion.
  // Para roles con solo CONSULTA el botón Volver siempre está habilitado
  // (no se bloquea por registros no verificados).
  const canEdit = puedeEditar(rol, PANTALLAS.DATOS_GUARDADOS_CELULAR);

  const guardarRegistro = async (item) => {
    const ts = new Date().toISOString();
    console.log('[diag] guardarRegistro START', ts, { id: item?.id });
    try {
      console.log('[diag] guardarRegistro STACK', new Error().stack);
    } catch (e) {
      // ignore
    }
    if (!isOnline) {
      alert('No hay conexión');
      return;
    }

    // --- Firebase duplicate check before syncing local record ---
    try {
      const uniqueKey = crearUniqueKey(item);
      if (uniqueKey) {
        const dupSnap = await getDocs(
          query(collection(db, 'estimaciones'), where('uniqueKey', '==', uniqueKey))
        );
        // 2026-11-07: un registro anulado no debe bloquear la sincronizacion.
        const dupVivos = dupSnap.docs.filter((d) => d.data()?.anulado !== true);
        if (dupVivos.length > 0) {
          alert('Ya existe una estimación para esta Cosecha, Tipo, GF, Lote, Parcela y Año.');
          setDuplicadosDetectados((prev) => ({ ...prev, [item.id]: true }));
          return;
        }
      }
    } catch (dupErr) {
      console.error('[PantallaDatosGuardadosCelular] duplicate check error', dupErr);
      // Non-blocking: if duplicate check fails, allow the sync to proceed
    }
    // --- End duplicate check ---

    const result = await syncRegistro(item.id);
    if (result.success) {
      alert('Registro sincronizado correctamente');
      return;
    }

    alert(`Error sincronizando registro: ${result.error || 'falló la sincronización'}`);
  };

  const eliminarRegistroDuplicado = (id) => {
    const confirmar = window.confirm(
      'Este registro local ya existe en Firebase. ¿Desea eliminarlo del celular?'
    );
    if (!confirmar) return;
    eliminarRegistroLocal(id);
    setDuplicadosDetectados((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  useEffect(() => {
    console.log('[diag] PantallaDatosGuardadosCelular isOnline change', new Date().toISOString(), { isOnline });
    try {
      console.log('[diag] isOnline STACK', new Error().stack);
    } catch (e) {
      // ignore
    }
  }, [isOnline]);

  console.log(
    'savedSamplingId:',
    sessionStorage.getItem('savedSamplingId')
  );

  console.log(
    'verifiedSamplingId:',
    sessionStorage.getItem('verifiedSamplingId')
  );

  const handleBack = () => {
    // Para roles con solo CONSULTA (canEdit = false), el botón Volver siempre funciona.
    // Para roles con CONSULTA_EDICION (canEdit = true), se mantiene la validación
    // de registros no verificados antes de regresar a Cabecera.
    if (canEdit) {
      const pendingRegistros = registros.filter((item) => item.verificado !== true);
      if (pendingRegistros.length > 0) {
        alert('Debe validar la Toma Física guardada antes de regresar a Cabecera.');
        return;
      }
    }

    navigate('/estimaciones/muestreo');
  };

  return (
    <div style={{ padding: 0 }}>
  <div
    style={{
      background: '#15803d',
      width: '100vw',
      marginLeft: 'calc(50% - 50vw)',
      marginRight: 'calc(50% - 50vw)',

      display: 'flex',
      alignItems: 'center',
      gap: 16,

      padding: '10px 12px',
      marginBottom: 20,
      boxSizing: 'border-box',
    }}
  >

  {/* Botón Volver:
      - Roles con CONSULTA_EDICION: bloqueado si hay registros no verificados.
      - Roles con solo CONSULTA: siempre habilitado. */}
  <button
    type="button"
    onClick={handleBack}
    style={{
      width: 42,
      height: 33,
      border: 'none',
      borderRadius: 12,
      background: 'linear-gradient(135deg, #16a34a, #15803d)',
      color: '#fff',/* Color blanco para el ícono de flecha */
      fontSize: 30,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 10px rgba(22,163,74,0.25)',
    }}
  >
    <span
    style={{
      transform: 'translateY(-7px)',
      display: 'block',
    }}
   >
    ← 
  </span>
    </button>

  <h2
  style={{
    margin: 0,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 800,
  }}
>
  Registros guardados (local)
</h2>

</div>
      

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 8,
        }}
      >
        {registros.map((item) => {
          console.log('[diag] render item row', new Date().toISOString(), { id: item.id, isOnline });
          if (isOnline) {
            console.log('[diag] render 💾 button for item', new Date().toISOString(), { id: item.id });
          }
          return (
          <div
            key={item.id}
            style={{
              display: 'grid', 
              gridTemplateColumns: '32px 35px 15px 20px 65px 1fr 55px',
              alignItems: 'center',
              gap: 4,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 8,
              fontSize: 12,
            }}
          >
            <div>{item.Cosecha || '--'}</div>

            <div>{item.GF || item.gf || '--'}</div>

            <div>{item.lote || item.Lote || '--'}</div>

            <div>{item.parcela || item.Parcela || '--'}</div>

            <div>
              {Number(item.area || item.Area || 0).toFixed(2)}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
              {/* Botón sincronizar (💾): solo para roles con edición */}
              {isOnline && canEdit && (
                <button
                  onClick={() => guardarRegistro(item)}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer' }}
                  title="Sincronizar"
                >
                  💾
                </button>
              )}

              {/* Botón editar (✏️): solo para roles con edición */}
              {canEdit && (
                <button
                  type="button"
                  title="Editar registro"
                  onClick={() => {
                    console.log('ITEM COMPLETO:', item);
                    console.log('ITEM ID:', item.id);
                    console.log('ITEM UNIQUEKEY:', item.uniqueKey);

                    actualizarRegistroLocal(item.id, {
                      verificado: true,
                    });

                    navigate('/estimaciones/muestreo', {
                      state: {
                        header: {
                          Cosecha: item.Cosecha || item.cosecha || '',
                          Tipo: item.Tipo || item.tipo || '',
                          Semana: item.Semana || item.semana || '',
                          Forza: item.Forza || item.forza || '',
                          Lote: item.Lote || item.lote || '',
                          Parcela: item.Parcela || item.parcela || '',
                          Poblacion: item.Poblacion || item.poblacion || '',
                          PtasEstac: item.PtasEstac || item.ptasEstac || '',
                          PtasMues:
                            item.PtasMues ||
                            item.PtasMuestras ||
                            item.ptasMues ||
                            '',
                          Area: item.Area || item.area || '',
                          GF: item.GF || item.gf || '',
                          uniqueKey:
                            item.uniqueKey ||
                            item.uniqueID ||
                            '',
                        },

                        detalle:
                          item.detalle ||
                          item.Detalle ||
                          [],

                        mode: 'edit-local',

                        localId: item.id,
                      },
                    });

                  }}
                  style={{ marginLeft: 8, background: '#16a34a', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer' }}
                >
                  ✏️
                </button>
              )}

              {duplicadosDetectados[item.id] && (
                <button
                  type="button"
                  title="Eliminar registro local duplicado"
                  onClick={() => eliminarRegistroDuplicado(item.id)}
                  style={{ marginLeft: 4, background: '#16a34a', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer' }}
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        )
        })}
      </div>
    </div>
  );
}

export default PantallaDatosGuardadosCelular;