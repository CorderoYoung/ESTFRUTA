import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MOCK_DATA = [
  {
    id: 1,
    pc: 'PC',
    tipo: 'C1',
    gf: '11-12',
    lote: '21',
    seccion: '11',
    aprobado: true,
    area: '0.75',
  },
  {
    id: 2,
    pc: 'RC',
    tipo: 'C1',
    gf: '11-12',
    lote: '21',
    seccion: '28',
    aprobado: true,
    area: '0.21',
  },
  {
    id: 3,
    pc: 'PC',
    tipo: 'C1',
    gf: '11-12',
    lote: '2',
    seccion: '58',
    aprobado: false,
    area: '1',
  },
];

function PantallaConsultaEstFruta({ user }) {
  const navigate = useNavigate();

  const [selectedGF, setSelectedGF] = useState('');
  const [selectedLote, setSelectedLote] = useState('');
  const [selectedSeccion, setSelectedSeccion] = useState('');

  const gfOptions = useMemo(() => {
    return [...new Set(MOCK_DATA.map((x) => x.gf))];
  }, []);

  const loteOptions = useMemo(() => {
    return [
      ...new Set(
        MOCK_DATA.filter((x) =>
          selectedGF ? x.gf === selectedGF : true
        ).map((x) => x.lote)
      ),
    ];
  }, [selectedGF]);

  const seccionOptions = useMemo(() => {
    return [
      ...new Set(
        MOCK_DATA.filter((x) => {
          return (
            (!selectedGF || x.gf === selectedGF) &&
            (!selectedLote || x.lote === selectedLote)
          );
        }).map((x) => x.seccion)
      ),
    ];
  }, [selectedGF, selectedLote]);

  const filteredData = useMemo(() => {
    return MOCK_DATA.filter((x) => {
      return (
        (!selectedGF || x.gf === selectedGF) &&
        (!selectedLote || x.lote === selectedLote) &&
        (!selectedSeccion || x.seccion === selectedSeccion)
      );
    });
  }, [selectedGF, selectedLote, selectedSeccion]);

  const canCreate =
    user?.Rol === 'Supervisor' ||
    user?.Rol === 'Muestreador';

  return (
    <div className="sampling-shell">

      {/* HEADER */}
      <div className="sampling-shell__header">

        <button
          className="sampling-shell__back"
          onClick={() => navigate('/login')}
        >
          ⌂
        </button>

        <div className="sampling-shell__context">
          GF {selectedGF || '--'} | L {selectedLote || '--'} | S {selectedSeccion || '--'}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>

          <button className="sampling-save-button">
            ↻
          </button>

          <button className="sampling-save-button">
            📈
          </button>

          {canCreate && (
            <button
              className="sampling-save-button"
              onClick={() => navigate('/estimaciones/muestreo')}
            >
              +
            </button>
          )}

        </div>
      </div>

      {/* FILTROS */}
      <div
        className="estimation-form-grid"
        style={{ padding: 8 }}
      >

        <div className="estimation-form-field">
          <label>GF</label>

          <select
            value={selectedGF}
            onChange={(e) => {
              setSelectedGF(e.target.value);
              setSelectedLote('');
              setSelectedSeccion('');
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

        <div className="estimation-form-field">
          <label>Lote</label>

          <select
            value={selectedLote}
            onChange={(e) => {
              setSelectedLote(e.target.value);
              setSelectedSeccion('');
            }}
          >
            <option value="">Todos</option>

            {loteOptions.map((lote) => (
              <option key={lote} value={lote}>
                {lote}
              </option>
            ))}
          </select>
        </div>

        <div className="estimation-form-field">
          <label>Sección</label>

          <select
            value={selectedSeccion}
            onChange={(e) => setSelectedSeccion(e.target.value)}
          >
            <option value="">Todas</option>

            {seccionOptions.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
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
                '40px 40px 60px 40px 40px 30px 50px 40px 40px',
              alignItems: 'center',
              gap: 4,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 10,
              padding: 6,
              fontSize: 12,
              fontWeight: 700,
            }}
          >

            <div>{item.pc}</div>
            <div>{item.tipo}</div>
            <div>{item.gf}</div>
            <div>{item.lote}</div>
            <div>{item.seccion}</div>

            <div>
              {item.aprobado ? '✓' : ''}
            </div>

            <div>{item.area}</div>

            <button
              className="sampling-save-button"
              onClick={() =>
                navigate(`/estimaciones/editar/${item.id}`)
              }
            >
              ✎
            </button>

            <button className="sampling-save-button">
              📈
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}

export default PantallaConsultaEstFruta;