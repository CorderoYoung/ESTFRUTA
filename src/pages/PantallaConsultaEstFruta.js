import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig.js';
import { useEffect, useMemo, useState } from 'react';
import useOffline from '../hooks/useOffline';
import { useNavigate } from 'react-router-dom';


function PantallaConsultaEstFruta({ user }) {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [selectedGF, setSelectedGF] = useState('');
  const [selectedLote, setSelectedLote] = useState('');
  const [selectedSeccion, setSelectedSeccion] = useState('');

  const { registrosLocales, isOnline } = useOffline();

  const cargarRegistrosFirebase = async () => {
  try {
    const querySnapshot = await getDocs(
      collection(db, 'estimaciones')
    );
    const datos = querySnapshot.docs.map((doc) => {

  const data = doc.data();
  return {
  id: doc.id,

  gf: data.gf || data.GF || '',
  lote: data.lote || data.Lote || '',

  seccion:
    data.seccion ||
    data.parcela ||
    data.Parcela ||
    '',

  pc:
    data.pc ||
    data.cosecha ||
    data.Cosecha ||
    '',

  tipo: data.tipo || data.Tipo || '',
  area: data.area || data.Area || '',

  aprobado: true,
};

});

    console.log('REGISTROS FIREBASE:', datos);
    // merge local pending registros so user can see both
    const merged = [...(datos || [])];
    if (Array.isArray(registrosLocales) && registrosLocales.length) {
      const localMapped = registrosLocales.map((r) => ({
        ...r,
        id: `local-${r.id}`,
        pc: r.Cosecha || r.cosecha || r.pc || '',
        tipo: r.Tipo || r.tipo || '',
        GF: r.gf || r.GF || '',
        lote: r.Lote || r.lote || '',
        seccion: r.Parcela || r.parcela || r.seccion || '',
        area: r.Area || r.area || '',
        aprobado: false,
        _local: true,
      }));
      merged.push(...localMapped);
    }

    setRegistros(merged);
    const datosFiltrados = merged.filter(
  (x) =>
    x.gf &&
    x.tipo &&
    x.lote
);

setRegistros(datosFiltrados);
  } catch (error) {
    console.error(error);
  }
};

  const gfOptions = useMemo(() => {
    return [...new Set(registros.map((x) => x.gf))];
  }, [registros]);

  useEffect(() => {

  cargarRegistrosFirebase();

  }, []);

  const loteOptions = useMemo(() => {
    return [
      ...new Set(
        registros.filter((x) =>
          selectedGF ? x.gf === selectedGF : true
        ).map((x) => x.lote)
      ),
    ];
  }, [selectedGF, registros]);

  const seccionOptions = useMemo(() => {
    return [
      ...new Set(
        registros.filter((x) => {
          return (
            (!selectedGF || x.gf === selectedGF) &&
            (!selectedLote || x.lote === selectedLote)
          );
        }).map((x) => x.seccion)
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

  return (
    <div className="sampling-shell">

      {/* HEADER */}
      <div className="sampling-shell__header">

        <button
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            background: '#f1f1f1',
            fontSize: 14,
          }}
          onClick={() => navigate('/login')}
        >
          ⌂
        </button>

        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <span>GF {selectedGF || '--'}</span>
          <span>|</span>
          <span>L {selectedLote || '--'}</span>
          <span>|</span>
          <span>S {selectedSeccion || '--'}</span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 15,
            flexShrink: 0,
          }}
        >

          <button
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            border: 'none',
            background: '#16a34a',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: 0,
          }}
        >
            ↻
          </button>

          <button
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            border: 'none',
            background: '#16a34a',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: 0,
          }}
        >
            📈
          </button>

          {canCreate && (
            <button
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                border: 'none',
                background: '#16a34a',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                padding: 0,
              }}
              onClick={() => navigate('/estimaciones/nueva')}
            >
              +
            </button>
          )}

        </div>
      </div>

      {/* FILTROS */}
        <div
    style={{
      display: 'flex',
      gap: 6,
      padding: 8,
      alignItems: 'flex-end',
    }}
  >
    {/* GF */}
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          marginBottom: 2,
        }}
      >
        GF
      </div>

      <select
        value={selectedGF}
        onChange={(e) => {
          setSelectedGF(e.target.value);
          setSelectedLote('');
          setSelectedSeccion('');
        }}
        style={{
          width: '100%',
          height: 34,
          borderRadius: 8,
          border: '1px solid #ccc',
          fontSize: 12,
        }}
      >
        <option value="">Todos</option>

        {gfOptions.map((gf) => (
          <option key={gf} value={gf}>
            {gf}
          </option>
        ))}
      </select>
    </div>

    {/* LOTE */}
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          marginBottom: 2,
        }}
      >
        LOTE
      </div>

      <select
        value={selectedLote}
        onChange={(e) => {
          setSelectedLote(e.target.value);
          setSelectedSeccion('');
        }}
        style={{
          width: '100%',
          height: 34,
          borderRadius: 8,
          border: '1px solid #ccc',
          fontSize: 12,
        }}
      >
        <option value="">Todos</option>

        {loteOptions.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </div>

    {/* SECCION */}
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          marginBottom: 2,
        }}
      >
        SECCION
      </div>

      <select
        value={selectedSeccion}
        onChange={(e) =>
          setSelectedSeccion(e.target.value)
        }
        style={{
          width: '100%',
          height: 34,
          borderRadius: 8,
          border: '1px solid #ccc',
          fontSize: 12,
        }}
      >
        <option value="">Todas</option>

        {seccionOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  </div>

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
                '28px 28px 48px 28px 28px 22px 40px 40px 24px',
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

            <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginLeft: -12
                }}
              >
                {item.aprobado ? (

                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#166534',
                      color: 'white',
                      fontSize: 11,
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ✓
                  </div>

                ) : item.ptasMues === item.frutasTotales ? (

                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#22c55e',
                    }}
                  />

                ) : (

                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#f97316',
                    }}
                  />

                )}
            </div>

            <div>{item.area}</div>

            <button
              style={{
                width: 22,
                height: 22,
                border: 'none',
                borderRadius: 5,
                background: '#16a34a',
                color: '#fff',
                fontSize: 10,
              }}
              onClick={() =>
                navigate(`/estimaciones/editar/${item.id}`)
              }
            >
              ✎
            </button>

            <button
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              padding: 0,
              justifySelf: 'end',
            }}
          >
              📈
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}

export default PantallaConsultaEstFruta;