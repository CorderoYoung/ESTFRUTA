import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useOffline from '../hooks/useOffline';

function PantallaDatosGuardadosCelular() {
  const { isOnline, registrosLocales = [], syncRegistro, eliminarRegistroLocal } = useOffline();
  const navigate = useNavigate();

  const registros = useMemo(() => registrosLocales || [], [registrosLocales]);

  const guardarRegistro = (item) => {
    if (!isOnline) {
      alert('No hay conexión');
      return;
    }
    syncRegistro(item);
  };

  return (
    <div style={{ padding: 12 }}>
      <h2>Registros guardados (local)</h2>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 8,
        }}
      >
        {registros.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 48px 1fr 120px',
              alignItems: 'center',
              gap: 8,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 8,
              fontSize: 12,
            }}
          >
            <div>{item.pc}</div>
            <div>{item.GF || item.gf || '--'}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.uniqueKey || item.id}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {isOnline && (
                <button
                  onClick={() => guardarRegistro(item)}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer' }}
                  title="Sincronizar"
                >
                  💾
                </button>
              )}

              <button
                type="button"
                title="Editar registro"
                onClick={() => {
                  navigate('/estimaciones/muestreo', {
                    state: {
                      header: {
                        Cosecha: item.Cosecha || item.cosecha || item.pc || '',
                        Tipo: item.Tipo || item.tipo || '',
                        Semana: item.Semana || item.semana || '',
                        Forza: item.Forza || item.forza || '',
                        Lote: item.Lote || item.lote || '',
                        Parcela: item.Parcela || item.parcela || item.seccion || '',
                        Poblacion: item.Poblacion || item.poblacion || '',
                        PtasEstac: item.PtasEstac || item.ptasEstac || '',
                        PtasMues:
                          item.PtasMues || item.PtasMuestras || item.ptasMues || '',
                        Area: item.Area || item.area || '',
                        GF: item.GF || item.gf || '',
                        uniqueKey: item.uniqueKey || item.uniqueId || '',
                      },
                      detalle: item.detalle || item.Detalle || [],
                      mode: 'edit-local',
                      localId: item.id,
                    },
                  });
                }}
                style={{ marginLeft: 8, background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer' }}
              >
                ✏️
              </button>

              <button
                type="button"
                title="Eliminar registro"
                onClick={() => {
                  if (window.confirm('Eliminar registro local?')) {
                    eliminarRegistroLocal(item.id);
                  }
                }}
                style={{ marginLeft: 8, background: '#fee2e2', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer' }}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PantallaDatosGuardadosCelular;
