import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig.js';
import { useEffect, useMemo, useState } from 'react';
import useOffline from '../hooks/useOffline';
import { useNavigate } from 'react-router-dom';
import { puedeEditar, PANTALLAS, ROLES } from '../constants/permissions';



function PantallaConsultaEstFruta({ user, onLogout }) {
  const navigate = useNavigate();
  const rol = user?.Rol;
  // Todos los roles tienen CONSULTA_EDICION en esta pantalla,
  // por lo que canEdit siempre será true según la nueva matriz.
  const canEdit = puedeEditar(rol, PANTALLAS.CONSULTA_EST_FRUTA);
  // El icono de gráfico/análisis se oculta solo para Muestreador.
  const canVerGrafico = rol !== ROLES.MUESTREADOR;
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
    // 2026-11-07: excluir registros anulados (borrado logico).
    const datos = querySnapshot.docs
      .filter((doc) => doc.data()?.anulado !== true)
      .map((doc) => {

  const data = doc.data();

  // Normalise to string so filters work regardless of number/string type in Firebase
  const loteRaw    = data.Lote    ?? data.lote    ?? '';
  const parcelaRaw = data.Parcela ?? data.parcela ?? data.seccion ?? '';

  return {
    id: doc.id,

    // GF: uppercase field takes priority (set by estimationService)
    gf: data.GF || data.gf || '',

    // Lote / Parcela: stored as numbers by estimationService; stringify for display/filter
    lote:   String(loteRaw),
    Lote:   String(loteRaw),
    seccion: String(parcelaRaw),
    Parcela: String(parcelaRaw),

    // Cosecha / Tipo
    pc:   data.Cosecha  || data.cosecha  || data.pc   || '',
    tipo: data.Tipo     || data.tipo     || '',

    // Area
    area: data.Area ?? data.area ?? '',

    // Indicador de aprobación: usa el campo `verificado` existente en Firebase.
    // true  → círculo verde oscuro con ✓ (aprobado por Supervisor Estimacion)
    // false → círculo naranja (pendiente de aprobación)
    aprobado: data.verificado === true,
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
        // Los registros locales nunca están aprobados (aún no están en Firebase)
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

  const normalizar = (value) => String(value ?? '').trim();

  const filteredData = useMemo(() => {
    return registros
      .filter((x) => {
        const xGF      = normalizar(x.GF ?? x.gf);
        const xLote    = normalizar(x.Lote ?? x.lote);
        const xSeccion = normalizar(x.Parcela ?? x.parcela ?? x.seccion ?? x.Seccion);
        return (
          (!selectedGF      || normalizar(selectedGF)      === xGF) &&
          (!selectedLote    || normalizar(selectedLote)    === xLote) &&
          (!selectedSeccion || normalizar(selectedSeccion) === xSeccion)
        );
      })
      .sort((a, b) => {
        const loteA    = Number(a.Lote ?? a.lote ?? 0);
        const loteB    = Number(b.Lote ?? b.lote ?? 0);
        const parcelaA = Number(a.Parcela ?? a.parcela ?? a.seccion ?? 0);
        const parcelaB = Number(b.Parcela ?? b.parcela ?? b.seccion ?? 0);
        if (loteA !== loteB) return loteA - loteB;
        return parcelaA - parcelaB;
      });
  }, [selectedGF, selectedLote, selectedSeccion, registros]);

  return (
    <div className="sampling-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>

      {/* HEADER */}
      <div className="sampling-shell__header">

        <button
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#dc2626',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
          onClick={onLogout}
        >
          Exit
        </button>

        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
            fontSize: 14,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            color: '#fff',
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
            gap: 30, /* espacio entre los botones */
            flexShrink: 0,
            
          }}
        >

          {/*<button
            onClick={() =>
              navigate('/estimaciones/analisis')
            }
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
              cursor: 'pointer',
            }}
          >
            📈
          </button> */}

          {/* Icono de gráfico: visible para todos los roles EXCEPTO Muestreador */}
          {canVerGrafico && (
            <button
            style={{
              width: 25,
              height: 25,
              borderRadius: 7,
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              padding: 0,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/estimaciones/gf')}
          >
              📊
            </button>
          )}

            {canEdit && (
            <button
              type="button"
              style={{
                width: 25,
                height: 25,
                borderRadius: 7,
                border: 'none',
                background: '#16a34a',
                color: 'white',
                fontSize: 14,
                fontWeight: 700,
                padding: 0,
              }}
              onClick={() => {

                // Check if there are unverified local records
                const hasPendingLocal = 
                  Array.isArray(registrosLocales) && 
                  registrosLocales.some(r => r.verificado !== true);

                if (hasPendingLocal) {
                  alert(
                    'Debe verificar la Toma Física guardada antes de crear una nueva Cabecera'
                  );
                  return;
                }

                navigate('/estimaciones/nueva');

              }}
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
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: 80,
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

            

            <div>{item.area}</div>

          {/*
            Indicador de aprobación:
            ● Verde oscuro con ✓ → verificado: true en Firebase (aprobado por Supervisor)
            ● Naranja            → verificado: false / ausente (pendiente de aprobación)

            Se eliminó el estado intermedio "verde claro" (ptasMues === frutasTotales)
            porque ese dato no está disponible en el listado; la única fuente de verdad
            es el campo `verificado` de Firebase.
          */}
          <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginLeft: -12
                }}
              >
                {item.aprobado ? (
                  /* Aprobado: verificado === true en Firebase */
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
                    title="Aprobado"
                  >
                    ✓
                  </div>
                ) : (
                  /* Pendiente: verificado === false o campo ausente */
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#f97316',
                    }}
                    title="Pendiente de aprobación"
                  />
                )}
            </div>
            
           {canEdit && (
           <button
              type="button"
              style={{
                width: 22,
                height: 22,
                border: 'none',
                borderRadius: 5,
                background: '#16a34a',
                color: '#000000',
                fontSize: 10,
                marginLeft: 40,

                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                cursor: 'pointer',
              }}
              onClick={() => {
                navigate(`/estimaciones/editar/${item.id}`);
              }}
            >
              ✏️
            </button>
           )}

            {/* 
              BOTÓN EDITAR / ABRIR SECCIÓN - TEMPORALMENTE DESACTIVADO

              <button
                type="button"
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
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`/estimaciones/seccion/${item.id}`);
                }}
              >
                📝
              </button>
              */}

          </div>
        ))}
      </div>
    </div>
  );
}

export default PantallaConsultaEstFruta;