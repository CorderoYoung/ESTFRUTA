import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { proyectarCajas } from '../services/estfrutaAnalysisService';
import './PantallaEstimacionPorGF.css';

// ─── Constantes ────────────────────────────────────────────────────────────────

const TAMANO_KEYS = [5, 6, 7, 8, 9, 10, 11, 12];

// ─── Colores por tamaño ────────────────────────────────────────────────────────

const COLOR_FONDO = {
  5: '#006b35',
  6: '#2f8f58',
  7: '#5fbd62',
  8: '#ffe08a',
  9: '#ffb164',
  10: '#f66b45',
  11: '#dd3029',
  12: '#b4002d',
};

const COLOR_TEXTO = {
  8: '#333',
  9: '#333',
};

// ─── Leer tamaños y defectos desde detalle[] ──────────────────────────────────

function extraerMuestras(doc) {
  const tamanos = {};
  TAMANO_KEYS.forEach((k) => {
    tamanos[k] = 0;
  });

  let defectos = 0;
  const motivosMap = {};

  const detalle = Array.isArray(doc.detalle) ? doc.detalle : [];

  detalle.forEach((item) => {
    const cantidad = Number(item.cantidadDelta) || 0;

    if (item.tipoLinea === 'TAMANO') {
      const key = Number(item.codigoClasificacion);

      if (TAMANO_KEYS.includes(key)) {
        tamanos[key] += cantidad;
      }
    } else if (item.tipoLinea === 'DEFECTO') {
      defectos += cantidad;

      const codigo = item.codigoClasificacion ?? item.codigo ?? 'Sin código';
      const nombre =
        item.descripcion ??
        item.nombreClasificacion ??
        item.nombre ??
        codigo;

      const clave = `${codigo}||${nombre}`;
      motivosMap[clave] = (motivosMap[clave] || 0) + cantidad;
    }
  });

  return { tamanos, defectos, motivosMap };
}

// ─── Motor de cálculo GF ──────────────────────────────────────────────────────

function calcularGF(registrosFiltrados) {
  const tamAcum = {};
  TAMANO_KEYS.forEach((k) => {
    tamAcum[k] = 0;
  });

  let defAcum = 0;
  let ptasAcum = 0;
  let areaAcum = 0;
  const motivosAcum = {};

  registrosFiltrados.forEach((doc) => {
    const { tamanos, defectos, motivosMap } = extraerMuestras(doc);

    TAMANO_KEYS.forEach((k) => {
      tamAcum[k] += tamanos[k];
    });

    defAcum += defectos;
    ptasAcum += Number(doc.PtasEstac ?? doc.ptasEstac ?? doc.PtasEstacion ?? 0) || 0;
    areaAcum += Number(doc.Area ?? doc.area ?? 0) || 0;

    Object.entries(motivosMap).forEach(([clave, cant]) => {
      motivosAcum[clave] = (motivosAcum[clave] || 0) + cant;
    });
  });

  const totalEmpacables = TAMANO_KEYS.reduce((s, k) => s + tamAcum[k], 0);
  const totalMuestra = totalEmpacables + defAcum;

  if (totalMuestra === 0 || ptasAcum === 0) return null;

  // Motor único (ver CODEX "Auditoría de Motores de Cálculo — 2026-07-28").
  const proyeccion = proyectarCajas({
    tamanos: tamAcum,
    totalDefectos: defAcum,
    ptasEst: ptasAcum,
    area: areaAcum,
  });

  const cajasPorTam = proyeccion.cajasPorTamano;
  const cajasRedondeadasPorTamano = proyeccion.cajasRedondeadasPorTamano;

  // KPI y color: SIEMPRE desde proyeccion.totalCajas (round-final).
  // Nunca reconstruir sumando cajasRedondeadasPorTamano.
  const cajasExport = proyeccion.totalCajas;
  const cajasNoEmp = proyeccion.cajasNoEmpacables;
  const totalDisp = proyeccion.totalCajasGeneral;

  const cajasHa = proyeccion.cajasHaEmpacables;
  const cajasHaNoEmp = proyeccion.cajasHaNoEmpacables;
  const cajasHaTotal = proyeccion.cajasHaTotal;

  const colorCajasHa =
    cajasHa >= 7500
      ? '#16a34a'
      : cajasHa >= 5500
        ? '#f59e0b'
        : '#dc2626';

  // totalCajasTabla es solo informativo (suma de la tabla T5-T12 ya
  // redondeada por fila) — puede diferir en ±1-2 del KPI cajasExport
  // por diseño. No usar para KPI/color.
  const totalCajasTabla = TAMANO_KEYS.reduce(
    (sum, k) => sum + cajasRedondeadasPorTamano[k],
    0
  );

  const porcentajePorTamano = {};

  TAMANO_KEYS.forEach((k) => {
    porcentajePorTamano[k] =
      totalCajasTabla > 0
        ? (cajasRedondeadasPorTamano[k] / totalCajasTabla) * 100
        : 0;
  });

  const grupoGrandes =
    porcentajePorTamano[5] +
    porcentajePorTamano[6] +
    porcentajePorTamano[7];

  const grupoIntermedios =
    porcentajePorTamano[8] +
    porcentajePorTamano[9];

  const grupoPequenos =
    porcentajePorTamano[10] +
    porcentajePorTamano[11] +
    porcentajePorTamano[12];

  const maxPct = Math.max(
    ...TAMANO_KEYS.map((k) => porcentajePorTamano[k] || 0)
  );

  const top12Motivos = Object.entries(motivosAcum)
    .map(([clave, total]) => {
      const [codigo, nombre] = clave.split('||');
      const abrev = nombre.length > 10 ? `${nombre.slice(0, 9)}…` : nombre;

      return {
        codigo,
        nombre,
        abrev,
        total,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const maxMotivo = top12Motivos.length > 0 ? top12Motivos[0].total : 1;

  return {
  cajasExport,
  cajasNoEmp,
  totalDisp,
  totalMotivosNoEmpaque: defAcum,
  areaAcum,
  cajasHa,
  cajasHaNoEmp,
  cajasHaTotal,
  cajasPorTam,
  tamAcum,
  cajasRedondeadasPorTamano,
  totalCajasTabla,
  porcentajePorTamano,
  grupoGrandes,
  grupoIntermedios,
  grupoPequenos,
  maxPct,
  colorCajasHa,
  top12Motivos,
  maxMotivo,
};
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PantallaEstimacionPorGF({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const gfInicial = location.state?.gfFijado ?? 'Todos';

  const [registros, setRegistros] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroPC, setFiltroPC] = useState('Todos');
  const [filtroGF, setFiltroGF] = useState(gfInicial);

  useEffect(() => {
    setFiltroGF(location.state?.gfFijado ?? 'Todos');
  }, [location.state?.gfFijado]);

  // ── Opciones dinámicas ────────────────────────────────────────────────────

  const pcOptions = useMemo(() => {
    return [
      ...new Set(
        registros
          .map((r) => r.Cosecha ?? r.cosecha ?? '')
          .filter(Boolean)
      ),
    ].sort();
  }, [registros]);

  const gfOptions = useMemo(() => {
    return [
      ...new Set(
        registros
          .map((r) => r.GF ?? r.gf ?? '')
          .filter(Boolean)
      ),
    ].sort();
  }, [registros]);

  // ── Carga Firebase ────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const snap = await getDocs(collection(db, 'estimaciones'));
      // 2026-11-07: excluir anulados para que no entren en las proyecciones.
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.anulado !== true);

      setRegistros(docs);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las estimaciones. Verifique conexión.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ── Filtrado ──────────────────────────────────────────────────────────────

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      const cosecha = r.Cosecha ?? r.cosecha ?? '';
      const gf = r.GF ?? r.gf ?? '';

      const okPC = filtroPC === 'Todos' || cosecha === filtroPC;
      const okGF = filtroGF === 'Todos' || gf === filtroGF;

      return okPC && okGF;
    });
  }, [registros, filtroPC, filtroGF]);

  // ── Cálculo ───────────────────────────────────────────────────────────────

  const res = useMemo(() => {
    return registrosFiltrados.length > 0
      ? calcularGF(registrosFiltrados)
      : null;
  }, [registrosFiltrados]);

  const fmt = (n) =>
    n == null ? '—' : Math.round(n).toLocaleString('es-CR');

  const gfLabel = filtroGF === 'Todos' ? 'Todos los GF' : `GF ${filtroGF}`;
  const pcLabel = filtroPC === 'Todos' ? '' : ` · ${filtroPC}`;

  // ── Estados ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="pgf-page">
        <div className="pgf-loading">
          <p>Calculando estimación por GF…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pgf-page">
        <div className="pgf-error">
          <p>⚠️ {error}</p>

          <button
            type="button"
            onClick={cargarDatos}
            style={{
              marginTop: 12,
              padding: '8px 18px',
              border: '1.5px solid #dc2626',
              borderRadius: 8,
              background: '#fff',
              color: '#dc2626',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pgf-page">

      {/* Header */}
      <header className="pgf-header">
        <button
          type="button"
          className="pgf-back"
          onClick={() => navigate('/estimaciones/consulta')}
          aria-label="Volver a consulta"
          title="Volver a consulta"
        >
          ←
        </button>

        <div className="pgf-header-title">
          <h1>Estimación por GF</h1>
          <span>{gfLabel}{pcLabel}</span>
        </div>

        <button
          type="button"
          className="pgf-back"
          onClick={() =>
            navigate('/estimaciones/analisis', {
              state: { gfFijado: filtroGF === 'Todos' ? null : filtroGF },
            })
          }
          aria-label="Análisis GF-Lote"
          title="Análisis GF-Lote"
        >
          📈
        </button>
      </header>
 
      <main className="pgf-content">
 
        {/* Filtros */}
        <div className="pgf-filters">
          <select
            value={filtroGF}
            onChange={(e) => setFiltroGF(e.target.value)}
            className="pgf-select"
          >
            <option value="Todos">Todos los GF</option>
 
            {gfOptions.map((gf) => (
              <option key={gf} value={gf}>
                GF {gf}
              </option>
            ))}
          </select>
 
          <select
            value={filtroPC}
            onChange={(e) => setFiltroPC(e.target.value)}
            className="pgf-select"
          >
            <option value="Todos">Todos</option>
 
            {pcOptions.map((pc) => (
              <option key={pc} value={pc}>
                {pc}
              </option>
            ))}
          </select>
        </div>

        {/* Info resumen GF */}
        <div className="pgf-summary-top">
          <div className="pgf-summary-item">
            <span className="pgf-summary-label">Parcelas</span>
            <span className="pgf-summary-value">
              {registrosFiltrados.length}
            </span>
          </div>

          <div className="pgf-summary-item">
            <span className="pgf-summary-label">Has GF</span>
            <span className="pgf-summary-value">
              {res ? res.areaAcum.toFixed(2) : '—'}
            </span>
          </div>
        </div>

        {!res ? (
          <div className="pgf-empty">
            <p>No hay estimaciones para los filtros seleccionados.</p>
          </div>
        ) : (
          <>

            {/* Resumen cajas */}
            <div className="pgf-total-box">
              <div className="pgf-total-row total">
                <span className="pgf-total-label">Total Cajas</span>
                <span className="pgf-total-count">
                  {fmt(res.totalDisp)}
                </span>
                <span className="pgf-total-ha-label">Cajas/Ha</span>
                <span className="pgf-total-ha-value">
                  {fmt(res.cajasHaTotal)}
                </span>
              </div>

              <div className="pgf-total-row no-empacables">
                <span className="pgf-total-label">Cajas No Empacables</span>
                <span className="pgf-total-count">
                  {fmt(res.cajasNoEmp)}
                </span>
                <span className="pgf-total-ha-label">Cajas/Ha</span>
                <span className="pgf-total-ha-value">
                  {fmt(res.cajasHaNoEmp)}
                </span>
              </div>

              <div className="pgf-total-row empacables">
                <span className="pgf-total-label">Cajas Empacables</span>
                <span className="pgf-total-count">
                  {fmt(res.cajasExport)}
                </span>
                <span
                  className="pgf-total-ha-label"
                  style={{ color: res.colorCajasHa }}
                >
                  Cajas/Ha
                </span>
                <span
                  className="pgf-total-ha-value"
                  style={{ color: res.colorCajasHa }}
                >
                  {fmt(res.cajasHa)}
                </span>
              </div>
            </div>

            {/* Tabla de tamaños */}
            <table className="pgf-size-table">
              <thead>
                <tr>
                  {TAMANO_KEYS.map((k) => (
                    <th
                      key={k}
                      style={{
                        background: COLOR_FONDO[k],
                        color: COLOR_TEXTO[k] ?? '#fff',
                      }}
                    >
                      T{k}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                <tr>
                  {TAMANO_KEYS.map((k) => (
                    <td key={k}>
                      {(res.cajasRedondeadasPorTamano?.[k] ?? 0).toLocaleString('es-CR')}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            {/* Gráfico de tamaños */}
            <section
              className="pgf-chart-card"
              role="button"
              tabIndex={0}
              onClick={() =>
                navigate('/estimaciones/analisis', {
                  state: {
                    gfFijado: filtroGF === 'Todos' ? null : filtroGF,
                  },
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/estimaciones/analisis', {
                    state: {
                      gfFijado: filtroGF === 'Todos' ? null : filtroGF,
                    },
                  });
                }
              }}
              aria-label={`Ver análisis de ${gfLabel}`}
              title={`Ver análisis de ${gfLabel}`}
              style={{ cursor: 'pointer' }}
            >
              <div className="pgf-size-chart">
                <h3 className="pgf-chart-title">
                  Distribución Curva de Tamaños (%)
                </h3>

                <div className="pgf-size-bars">
                  {TAMANO_KEYS.map((k) => {
                    const val = res.porcentajePorTamano[k] || 0;

                    const altura =
                      res.maxPct > 0
                        ? Math.max(2, Math.round((val / res.maxPct) * 85))
                        : 0;

                    return (
                      <div key={k} className="pgf-size-bar-item">
                        <span className="pgf-bar-value">
                          {Math.round(val)}
                        </span>

                        <div
                          className="pgf-size-bar"
                          style={{
                            height: `${altura}%`,
                            background: COLOR_FONDO[k],
                          }}
                        />

                        <span className="pgf-bar-label">
                          T{k}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pgf-groups">
                  <div className="pgf-group">
                    <span className="pgf-group-label">Grandes</span>
                    <span className="pgf-group-value">
                      {Math.round(res.grupoGrandes)}%
                    </span>
                  </div>

                  <div className="pgf-group">
                    <span className="pgf-group-label">Intermedios</span>
                    <span className="pgf-group-value">
                      {Math.round(res.grupoIntermedios)}%
                    </span>
                  </div>

                  <div className="pgf-group">
                    <span className="pgf-group-label">Pequeños</span>
                    <span className="pgf-group-value">
                      {Math.round(res.grupoPequenos)}%
                    </span>
                  </div>
                </div>

                {/*<div
                  style={{
                    marginTop: 4,
                    textAlign: 'right',
                    color: '#6b7280',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Toca para ver detalle →
                </div>*/}
              </div>
            </section>

            {/* Gráfico motivos de no empaque */}
            {res.top12Motivos.length > 0 && (
              <section className="pgf-chart-card pgf-defects-card">
                <h3 className="pgf-chart-title left">
                  PRINCIPALES 12 MOTIVOS DE NO EMPAQUE: {fmt(res.totalMotivosNoEmpaque)}
                </h3>

                <div className="pgf-defects-chart">
                  {res.top12Motivos.map((m, i) => {
                    const altura =
                      res.maxMotivo > 0
                        ? Math.max(4, Math.round((m.total / res.maxMotivo) * 85))
                        : 4;

                    return (
                      <div key={`${m.codigo}-${i}`} className="pgf-defect-item">
                        <span className="pgf-defect-value">
                          {m.total.toLocaleString('es-CR')}
                        </span>

                        <div
                          className={`pgf-defect-bar pgf-defect-color-${i + 1}`}
                          style={{
                            height: `${altura}%`,
                          }}
                        />

                        <span
                          className="pgf-defect-label"
                          title={m.nombre}
                        >
                          {m.abrev}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
