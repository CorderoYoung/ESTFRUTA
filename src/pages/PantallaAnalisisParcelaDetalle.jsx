import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { proyectarCajas } from '../services/estfrutaAnalysisService';
import './PantallaAnalisisParcelaDetalle.css';

// ─── Constantes ────────────────────────────────────────────────────────────────

const TAMANO_KEYS = [5, 6, 7, 8, 9, 10, 11, 12];

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '-';
  return Math.round(n).toLocaleString('es-CR');
}

function pctFmt(n) {
  if (!Number.isFinite(n)) return '0%';
  return `${Math.round(n)}%`;
}

function colorHa(cajasHa) {
  if (cajasHa >= 7500) return '#166534';
  if (cajasHa >= 5500) return '#f97316';
  return '#dc2626';
}

// ─── Motor de cálculo por parcela ─────────────────────────────────────────────

function calcular(data) {
  const tamanos = {};
  TAMANO_KEYS.forEach((k) => {
    tamanos[k] = 0;
  });

  const defectosMapa = {};
  let defectosTotal = 0;

  const detalle = Array.isArray(data.detalle) ? data.detalle : [];

  detalle.forEach((item) => {
    const cantidad = Number(item.cantidadDelta) || 0;

    if (item.tipoLinea === 'TAMANO') {
      const key = Number(item.codigoClasificacion);

      if (TAMANO_KEYS.includes(key)) {
        tamanos[key] += cantidad;
      }
    } else if (item.tipoLinea === 'DEFECTO') {
      defectosTotal += cantidad;

      const cod = item.codigoClasificacion || 'OTRO';
      defectosMapa[cod] = (defectosMapa[cod] || 0) + cantidad;
    }
  });

  const ptasEst =
    Number(
      data.PtasEstac ??
        data.ptasEstac ??
        data.PtasEstacion ??
        data.ptasMues ??
        0
    ) || 0;

  const area = Number(data.Area ?? data.area ?? 0) || 0;

  const totalEmp = TAMANO_KEYS.reduce((s, k) => s + tamanos[k], 0);
  const totalMuest = totalEmp + defectosTotal;

  if (totalMuest === 0 || ptasEst === 0) {
    return {
      cajasExport: 0,
      cajasNoEmp: 0,
      totalDisp: 0,
      totalMotivosNoEmpaque: defectosTotal,
      cajasHa: 0,
      area,
      cajasPorTam: Object.fromEntries(TAMANO_KEYS.map((k) => [k, 0])),
      cajasRedondeadasPorTam: Object.fromEntries(TAMANO_KEYS.map((k) => [k, 0])),
      pctPorTam: Object.fromEntries(TAMANO_KEYS.map((k) => [k, 0])),
      topDefectos: [],
    };
  }

  // Motor único (ver CODEX "Auditoría de Motores de Cálculo — 2026-07-28").
  const proyeccion = proyectarCajas({
    tamanos,
    totalDefectos: defectosTotal,
    ptasEst,
    area,
  });

  const cajasRedondeadasPorTam = proyeccion.cajasRedondeadasPorTamano; // solo para gráfico/tabla T5-T12

  const sumaCajasRed = TAMANO_KEYS.reduce(
    (s, k) => s + cajasRedondeadasPorTam[k],
    0
  );

  const pctPorTam = {};

  TAMANO_KEYS.forEach((k) => {
    pctPorTam[k] =
      sumaCajasRed > 0 ? (cajasRedondeadasPorTam[k] / sumaCajasRed) * 100 : 0;
  });

  // KPI/color: SIEMPRE proyeccion.totalCajas (round-final). Antes esta
  // pantalla usaba sumaCajasRed (suma de la tabla ya redondeada), lo que
  // causaba que "Cajas Exp" y el color de "Cajas/Ha" no coincidieran con
  // la lista de PantallaAnalisisGF_Lote.js para la misma parcela — ver
  // Auditoría de Motores de Cálculo, bug #1.
  const cajasExport = proyeccion.totalCajas;
  const cajasNoEmp = proyeccion.cajasNoEmpacables;
  const totalDisp = proyeccion.totalCajasGeneral;
  const cajasHa = proyeccion.cajasHaEmpacables;

  const topDefectos = Object.entries(defectosMapa)
    .map(([codigo, cantidad]) => ({ codigo, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 12);

  return {
    cajasExport,
    cajasNoEmp,
    totalDisp,
    totalMotivosNoEmpaque: defectosTotal,
    cajasHa,
    area,
    cajasPorTam: proyeccion.cajasPorTamano,
    cajasRedondeadasPorTam,
    pctPorTam,
    topDefectos,
  };
}

// ─── Componente ────────────────────────────────────────────────────────────────

export default function PantallaAnalisisParcelaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const gfFijado = location.state?.gfFijado ?? null;
  const loteRecibido = location.state?.lote ?? null;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const volverAlAnalisis = (loteActual = loteRecibido) => {
    navigate('/estimaciones/analisis', {
      state: {
        gfFijado,
        lote: loteActual,
      },
    });
  };

  useEffect(() => {
    async function cargar() {
      setIsLoading(true);
      setError('');

      try {
        const snap = await getDoc(doc(db, 'estimaciones', id));

        if (!snap.exists()) {
          setError('Estimación no encontrada.');
        } else {
          setData({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        console.error('[PantallaAnalisisParcelaDetalle] cargar error', err);
        setError('No se pudo cargar la estimación.');
      } finally {
        setIsLoading(false);
      }
    }

    cargar();
  }, [id]);

  // ── Estados ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="papd-page">
        <div className="papd-loading">
          <div className="papd-spinner" />
          <p>Cargando estimación…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="papd-page">
        <div className="papd-loading">
          <p className="papd-error-msg">⚠️ {error || 'Sin datos'}</p>

          <button
            type="button"
            onClick={() => volverAlAnalisis()}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#dc2626',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  // ── Campos de cabecera ────────────────────────────────────────────────────

  const tipo = data.Tipo ?? data.tipo ?? '-';
  const cosecha = data.Cosecha ?? data.cosecha ?? '-';
  const semana = data.Semana ?? data.semana ?? '-';
  const forza = data.Forza ?? data.forza ?? '-';
  const lote = data.Lote ?? data.lote ?? '-';
  const parcela = data.Parcela ?? data.parcela ?? '-';
  const poblacion = data.Poblacion ?? data.poblacion ?? '-';
  const ptasEstac = data.PtasEstac ?? data.ptasEstac ?? data.PtasEstacion ?? '-';
  const ptasMues = data.PtasMues ?? data.ptasMues ?? data.PtasMuestras ?? '-';
  const area = data.Area ?? data.area ?? '-';

  // ── Cálculo ───────────────────────────────────────────────────────────────

  const res = calcular(data);

  // ── Grupos grandes / intermedios / pequeños ───────────────────────────────

  const pctGrandes = [5, 6, 7].reduce((s, k) => s + (res.pctPorTam[k] || 0), 0);
  const pctIntermedios = [8, 9].reduce((s, k) => s + (res.pctPorTam[k] || 0), 0);
  const pctPequenos = [10, 11, 12].reduce((s, k) => s + (res.pctPorTam[k] || 0), 0);

  // ── Máximo para escala de barras ──────────────────────────────────────────

  const maxCajas = Math.max(
    ...TAMANO_KEYS.map((k) => res.cajasRedondeadasPorTam[k]),
    1
  );

  const maxDefecto = Math.max(
    ...res.topDefectos.map((d) => d.cantidad),
    1
  );

  // ── Colores barras defecto ────────────────────────────────────────────────

  const DEFECTO_COLORS = [
    '#7c3aed',
    '#2563eb',
    '#0891b2',
    '#059669',
    '#ca8a04',
    '#ea580c',
    '#dc2626',
    '#9f1239',
    '#4338ca',
    '#0f766e',
    '#a16207',
    '#92400e',
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="papd-page">

      {/* Header */}
      <header className="papd-header">
        <button
          type="button"
          className="papd-back"
          onClick={() => volverAlAnalisis(lote)}
          aria-label="Volver"
          title="Volver"
        >
          ←
        </button>

        <div className="papd-header-titles">
          <h1>Analisis Parcela Detalle</h1>
          <span>Lote {lote} · Parcela {parcela}</span>
        </div>
      </header>

      <div className="papd-scroll">

        {/* Encabezado compacto de la estimación */}
        <section className="papd-encabezado-compacto">
          <div className="papd-enc-grid-compacto">
            <div>
              <span>Tipo</span>
              <strong>{tipo}</strong>
            </div>

            <div>
              <span>Cos</span>
              <strong>{cosecha}</strong>
            </div>

            <div>
              <span>Semana</span>
              <strong>{semana}</strong>
            </div>

            <div>
              <span>Forza</span>
              <strong>{forza}</strong>
            </div>

            <div>
              <span>Lote</span>
              <strong>{lote}</strong>
            </div>

            <div>
              <span>Parcela</span>
              <strong>{parcela}</strong>
            </div>

            <div>
              <span>Población</span>
              <strong>{fmt(Number(poblacion))}</strong>
            </div>

            <div>
              <span>PtasEstacion</span>
              <strong>{fmt(Number(ptasEstac))}</strong>
            </div>

            <div>
              <span>PtasMuestras</span>
              <strong>{fmt(Number(ptasMues))}</strong>
            </div>

            <div>
              <span>Area</span>
              <strong>
                {Number.isFinite(Number(area))
                  ? Number(area).toLocaleString('es-CR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : area}
              </strong>
            </div>
          </div>
        </section>

        {/* Resumen en una línea */}
        <section className="papd-card papd-summary-card">
          <div className="papd-summary-grid">
            <div className="papd-summary-cell">
              <span className="papd-summary-label">Cajas Exp</span>
              <strong className="papd-summary-value">{fmt(res.cajasExport)}</strong>
            </div>

            <div className="papd-summary-cell">
              <span className="papd-summary-label">Cajas No Emp</span>
              <strong className="papd-summary-value">{fmt(res.cajasNoEmp)}</strong>
            </div>

            <div className="papd-summary-cell">
              <span className="papd-summary-label">Cajas / Ha</span>
              <strong
                className="papd-summary-value"
                style={{ color: colorHa(res.cajasHa) }}
              >
                {fmt(res.cajasHa)}
              </strong>
            </div>
          </div>
        </section>

        {/* Gráfico cajas por tamaño */}
        <section className="papd-card papd-card--grafico">
          <p className="papd-card-title">Cajas por Tamaño</p>

          <div className="papd-barras-wrap">
            {TAMANO_KEYS.map((k) => {
              const val = res.cajasRedondeadasPorTam[k] || 0;
              const altura =
                maxCajas > 0 ? Math.max(2, Math.round((val / maxCajas) * 100)) : 2;

              return (
                <div key={k} className="papd-barra-item">
                  <span className="papd-barra-valor">
                    {val.toLocaleString('es-CR')}
                  </span>

                  <div
                    className="papd-barra"
                    style={{
                      height: `${altura}%`,
                      background: COLOR_FONDO[k],
                    }}
                  />

                  <span className="papd-barra-label">T{k}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tabla horizontal porcentajes */}
        <section className="papd-card">
          <p className="papd-card-title">Porcentaje por Tamaño</p>

          <table className="papd-pct-table">
            <thead>
              <tr>
                {TAMANO_KEYS.map((k) => (
                  <th
                    key={k}
                    style={{
                      background: COLOR_FONDO[k],
                      color: COLOR_TEXTO[k] || '#fff',
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
                    {pctFmt(res.pctPorTam[k])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>

        {/* Grupos grandes / intermedios / pequeños */}
        <section className="papd-card">
          <div className="papd-grupos">
            <div className="papd-grupo-celda">
              <span className="papd-grupo-label">Grandes</span>
              <span className="papd-grupo-val">{pctFmt(pctGrandes)}</span>
            </div>

            <div className="papd-grupo-celda">
              <span className="papd-grupo-label">Intermedios</span>
              <span className="papd-grupo-val">{pctFmt(pctIntermedios)}</span>
            </div>

            <div className="papd-grupo-celda">
              <span className="papd-grupo-label">Pequeños</span>
              <span className="papd-grupo-val">{pctFmt(pctPequenos)}</span>
            </div>
          </div>
        </section>

        {/* Gráfico top 12 defectos */}
        <section className="papd-card papd-card--defectos papd-card--grafico">
          <p className="papd-card-title">
            Principales 12 Motivos de No Empaque: {fmt(res.totalMotivosNoEmpaque)}
          </p>

          {res.topDefectos.length === 0 ? (
            <p className="papd-empty-chart">
              Sin registros de defectos
            </p>
          ) : (
            <div className="papd-barras-wrap">
              {res.topDefectos.map((d, i) => {
                const altura = Math.max(
                  2,
                  Math.round((d.cantidad / maxDefecto) * 100)
                );

                return (
                  <div key={d.codigo} className="papd-barra-item">
                    <span className="papd-barra-valor">
                      {d.cantidad}
                    </span>

                    <div
                      className="papd-barra"
                      style={{
                        height: `${altura}%`,
                        background: DEFECTO_COLORS[i % DEFECTO_COLORS.length],
                      }}
                    />

                    <span
                      className="papd-barra-label"
                      title={d.codigo}
                    >
                      {d.codigo}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
