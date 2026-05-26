import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useOffline from '../hooks/useOffline';

function PantallaDatosGuardadosCelular() {

  const { isOnline, registrosLocales, syncRegistro, eliminarRegistroLocal } = useOffline();
  const registros = registrosLocales || [];

  const navigate = useNavigate();

  const [selectedGF, setSelectedGF] = useState('');
  const [selectedLote, setSelectedLote] = useState('');
  const [selectedSeccion, setSelectedSeccion] = useState('');

  const gfOptions = useMemo(() => {
    return [...new Set(registros.map((x) => x.gf))];
  }, [registros]);

  const loteOptions = useMemo(() => {
    return [
      ...new Set(
        registros.filter((x) => (selectedGF ? x.gf === selectedGF : true)).map((x) => x.lote)
      ),
    ];
  }, [selectedGF, registros]);

  const seccionOptions = useMemo(() => {
    return [
      ...new Set(
        registros
          .filter((x) => {
            return (!selectedGF || x.gf === selectedGF) && (!selectedLote || x.lote === selectedLote);
          })
          .map((x) => x.seccion)
      ),
    ];
  }, [selectedGF, selectedLote, registros]);

  const filteredData = useMemo(() => {
    return registros.filter((x) => {
      return (
        (!selectedGF || x.gf === selectedGF) &&
        (!selectedLote || x.lote === selectedLote) &&
        (!selectedSeccion || x.seccion === selectedSeccion)
      );
    });
  }, [selectedGF, selectedLote, selectedSeccion, registros]);

  const canCreate = true;

  // isOnline and registros reactivity provided by OfflineProvider



    const guardarRegistro = async (item) => {
    try {
      const res = await syncRegistro(item.id);
      if (res && res.success) {
        alert('Registro guardado en servidor');
      } else {
        alert('Error al guardar en servidor');
      }
    } catch (error) {
      console.error(error);
      alert('Error al guardar');
    }
  };


  return (
    <div className="sampling-shell">

      {/* HEADER */}
      
      <div className="sampling-shell__header">

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e5e5',
          background: '#ffffff',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            border: 'none',
            background: '#f3f4f6',
            borderRadius: 10,
            fontWeight: 700,
            cursor: 'pointer',
            marginLeft: -10,
            color: '#111',
          }}
        >
          ← Volver
        </button>
          
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            marginLeft: 16,
            fontWeight: 800,
            color: '#222',
          }}
        >
          Datos guardados en celular
        </h2>

          
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '0 8px 8px',
            }}
          >
            <button
              style={{
                background: isOnline
                    ? '#16a34a'
                    : '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 0px',
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              {isOnline
                ? 'Guardar Registros'
                : 'Sin conexión'}
            </button>
          </div>
        
      </div>

    </div>
        

      {/* FILTROS */}
       


      {/* GALERIA */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: 8,
        }}
      >

        {filteredData.map((item) => (
          <div
            key={item.id}
            style={{
            display: 'grid',
            gridTemplateColumns:
              '28px 28px 48px 28px 28px 22px 1fr 24px 24px',
            alignItems: 'center',
            gap: 4,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 10,
            padding: 4,
            fontSize: 10,
            fontWeight: 700,
          }}
          >

            <div>{item.pc}</div>
            <div>{item.tipo}</div>
            <div>{item.GF || item.gf || '--'}</div>
            <div>{item.lote}</div>
            <div>{item.seccion}</div>

            <div>{item.area}</div>

            <div></div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              {isOnline && (

                  <button
                      onClick={() => guardarRegistro(item)}
                      style={{
                        background: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 5,
                        width: 25,
                        height: 25,
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      💾
                    </button>

                
            )}
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

export default PantallaDatosGuardadosCelular;