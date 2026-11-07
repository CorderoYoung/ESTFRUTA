import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { proyectarCajas } from '../services/estfrutaAnalysisService';
import './PantallaAnalisisGF_Lote.css';

// ─── Constantes ────────────────────────────────────────────────────────────────

const TAMANO_KEYS = [5, 6, 7, 8, 9, 10, 11, 12];

const COLOR_FONDO = {
  5: '#006b35', 6: '#2f8f58', 7: '#5fbd62',
  8: '#ffe08a', 9: '#ffb164', 10: '#f66b45',
  11: '#dd3029', 12: '#b4002d',
};
const COLOR_TEXTO = { 8: '#333', 9: '#333' };

// ─── Extraer muestras desde detalle[] ─────────────────────────────────────────

function extraerMuestras(doc) {
  const tamanos = {};
  TAMANO_KEYS.forEach((k) => (tamanos[k] = 0));
  let defectos = 0;

  const detalle = Array.isArray(doc.detalle) ? doc.detalle : [];
  detalle.forEach((item) => {
    const cantidad = Number(item.cantidadDelta) || 0;
    if (item.tipoLinea === 'TAMANO') {
      const key = Number(item.codigoClasificacion);
      if (TAMANO_KEYS.includes(key)) tamanos[key] += cantidad;
    } else if (item.tipoLinea === 'DEFECTO') {
      defectos += cantidad;
    }
  });

  return { tamanos, defectos };
}

// ─── Cálculo agrupado (lote completo) ─────────────────────────────────────────

function calcularAgrupado(docs) {
  const tamAcum = {};
  TAMANO_KEYS.forEach((k) => (tamAcum[k] = 0));
  let defAcum = 0;
  let ptasAcum = 0;
  let areaAcum = 0;

  docs.forEach((doc) => {
    const { tamanos, defectos } = extraerMuestras(doc);
    TAMANO_KEYS.forEach((k) => { tamAcum[k] += tamanos[k]; });
    defAcum  += defectos;
    ptasAcum += Number(doc.PtasEstac ?? doc.ptasEstac ?? doc.PtasEstacion ?? 0) || 0;
    areaAcum += Number(doc.Area ?? doc.area ?? 0) || 0;
  });

  const totalEmpacables = TAMANO_KEYS.reduce((s, k) => s + tamAcum[k], 0);
  const totalMuestra    = totalEmpacables + defAcum;

  if (totalMuestra === 0 || ptasAcum === 0) return null;

  // Motor único (ver CODEX "Auditoría de Motores de Cálculo — 2026-07-28").
  const proyeccion = proyectarCajas({
    tamanos: tamAcum,
    totalDefectos: defAcum,
    ptasEst: ptasAcum,
    area: areaAcum,
  });

  // KPI: SIEMPRE proyeccion.totalCajas (round-final), nunca la suma de la
  // tabla redondeada por tamaño.
  const cajasExport = proyeccion.totalCajas;
  const cajasNoEmp   = proyeccion.cajasNoEmpacables;
  const totalDisp    = proyeccion.totalCajasGeneral;
  const cajasHa      = proyeccion.cajasHaEmpacables;

  return {
            cajasPorTam: proyeccion.cajasRedondeadasPorTamano, // solo para el gráfico de barras T5-T12
            cajasExport,
            cajasNoEmp,
            totalDisp,
            cajasHa,
            areaAcum,
          };
}

// ─── Cálculo individual por parcela ───────────────────────────────────────────

function calcularParcela(doc) {
  const { tamanos, defectos } = extraerMuestras(doc);
  const totalEmp    = TAMANO_KEYS.reduce((s, k) => s + tamanos[k], 0);
  const totalMuest  = totalEmp + defectos;
  const ptasEst     = Number(doc.PtasEstac ?? doc.ptasEstac ?? doc.PtasEstacion ?? 0) || 0;
  const area        = Number(doc.Area ?? doc.area ?? 0) || 0;

  if (totalMuest === 0 || ptasEst === 0) return { cajasExport: 0, cajasHa: 0, area };

  // Motor único (ver CODEX "Auditoría de Motores de Cálculo — 2026-07-28").
  const proyeccion = proyectarCajas({ tamanos, totalDefectos: defectos, ptasEst, area });

  return {
    cajasExport: proyeccion.totalCajas,
    cajasHa: proyeccion.cajasHaEmpacables,
    area,
  };
}

// ─── Indicador de color ────────────────────────────────────────────────────────

function colorIndicador(cajasHa) {
  if (cajasHa >= 7500) return '#166534'; // verde
  if (cajasHa >= 5500) return '#f97316'; // naranja
  return '#dc2626';                       // rojo
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function PantallaAnalisisGF_Lote({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const gfFijado = location.state?.gfFijado ?? null;
  const loteRecibido =
    location.state?.lote != null ? String(location.state.lote) : '';

  const [registros, setRegistros] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState('');
  const [filtroGF, setFiltroGF]   = useState(gfFijado ?? '');
  const [filtroLote, setFiltroLote] = useState(loteRecibido);

  // ── Carga Firebase ────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const snap = await getDocs(collection(db, 'estimaciones'));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRegistros(docs);

      // Conservar el GF recibido o preseleccionar el primero disponible.
      const primerGF = docs.map((r) => r.GF ?? r.gf ?? '').filter(Boolean).sort()[0];
      setFiltroGF(gfFijado ?? primerGF ?? '');
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las estimaciones.');
    } finally {
      setIsLoading(false);
    }
  }, [gfFijado]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  useEffect(() => {
    if (gfFijado) setFiltroGF(gfFijado);
  }, [gfFijado]);

  // ── Opciones de GF (dinámicas) ────────────────────────────────────────────
  const gfOptions = useMemo(() => {
    return [...new Set(registros.map((r) => r.GF ?? r.gf ?? '').filter(Boolean))].sort();
  }, [registros]);

  // ── Registros del GF seleccionado ─────────────────────────────────────────
  const registrosPorGF = useMemo(() => {
    if (!filtroGF) return [];
    return registros.filter((r) => (r.GF ?? r.gf ?? '') === filtroGF);
  }, [registros, filtroGF]);

  // ── Opciones de Lote (dependientes del GF) ────────────────────────────────
  const loteOptions = useMemo(() => {
    const lotes = [...new Set(
      registrosPorGF.map((r) => String(r.Lote ?? r.lote ?? '')).filter(Boolean)
    )].sort((a, b) => Number(a) - Number(b));
    return lotes;
  }, [registrosPorGF]);

  // Pre-seleccionar primer lote cuando cambia el GF
  useEffect(() => {
    setFiltroLote(
      loteRecibido && loteOptions.includes(loteRecibido)
        ? loteRecibido
        : loteOptions[0] ?? ''
    );
  }, [loteOptions, loteRecibido]);

  // ── Registros del Lote seleccionado ──────────────────────────────────────
  const registrosFiltrados = useMemo(() => {
    if (!filtroLote) return [];
    return registrosPorGF.filter((r) =>
      String(r.Lote ?? r.lote ?? '') === filtroLote
    );
  }, [registrosPorGF, filtroLote]);

  // ── Cálculo agrupado del lote ─────────────────────────────────────────────
  const resLote = useMemo(
    () => registrosFiltrados.length > 0 ? calcularAgrupado(registrosFiltrados) : null,
    [registrosFiltrados]
  );

  // ── Detalle por parcela ───────────────────────────────────────────────────
    const detalleParcelas = useMemo(() => {
        return registrosFiltrados.map((doc) => {
            const { cajasExport, cajasHa, area } = calcularParcela(doc);

            return {
            id: doc.id,
            cosecha: doc.Cosecha ?? doc.cosecha ?? '',
            lote: doc.Lote ?? doc.lote ?? '',
            parcela: doc.Parcela ?? doc.parcela ?? '',
            area,
            cajasExport,
            cajasHa,
            };
        }).sort((a, b) => {
            const loteA = Number(a.lote) || 0;
            const loteB = Number(b.lote) || 0;
            if (loteA !== loteB) return loteA - loteB;
            return (Number(a.parcela) || 0) - (Number(b.parcela) || 0);
          });
        }, [registrosFiltrados]);

        const resLoteDetalle = useMemo(() => {
        if (!detalleParcelas.length) return null;

        const cajasExport = detalleParcelas.reduce(
            (sum, p) => sum + (p.cajasExport || 0),
            0
        );

        const area = detalleParcelas.reduce(
            (sum, p) => sum + (Number(p.area) || 0),
            0
        );

        const cajasHa = area > 0 ? Math.round(cajasExport / area) : 0;

        return {
            cajasExport,
            area,
            cajasHa,
        };
        }, [detalleParcelas]);

            const fmt = (n) =>
            n == null ? '-' : Math.round(n).toLocaleString('es-CR');

  

  // ── Estados ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="agl-page">
        <div className="agl-loading">
          <div className="agl-spinner" />
          <p>Cargando análisis…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="agl-page">
        <div className="agl-loading">
          <p className="agl-error-msg">⚠️ {error}</p>
          <button className="agl-btn-sec" onClick={cargarDatos}>Reintentar</button>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="agl-page">

      {/* ── Header ── */}
      
        <header className="agl-header">
            <button
                className="agl-back"
                onClick={() =>
                  navigate('/estimaciones/gf', {
                    state: { gfFijado: gfFijado ?? filtroGF },
                  })
                }
                aria-label="Volver a estimación por GF"
                title="Volver a estimación por GF"
            >
                ← 
            </button>

            <div className="agl-header-center">
                <span className="agl-online">OnLine</span>
                <h1>Análisis por GF y Lote</h1>
            </div>
        </header>
        

      {/* ── Filtros GF + Lote ── */}
      <div className="agl-filtros">
        <div className="agl-filtro-grupo">
          <label className="agl-filtro-label">GF</label>
          {gfFijado ? (
            <div
              className="agl-select"
              aria-label={`GF ${gfFijado} bloqueado`}
              title="El GF se cambia en la pantalla Estimación por GF"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fff1f2',
                border: '1.5px solid #fda4af',
                color: '#9f1239',
                fontWeight: 700,
              }}
            >
              <span>GF {gfFijado}</span>
              <span aria-hidden="true">🔒</span>
            </div>
          ) : (
            <select
              className="agl-select"
              value={filtroGF}
              onChange={(e) => setFiltroGF(e.target.value)}
            >
              {gfOptions.map((o) => (
                <option key={o} value={o}>GF {o}</option>
              ))}
            </select>
          )}
        </div>
        <div className="agl-filtro-grupo">
          <label className="agl-filtro-label">Lote</label>
          <select
            className="agl-select"
            value={filtroLote}
            onChange={(e) => setFiltroLote(e.target.value)}
          >
            {loteOptions.map((o) => (
              <option key={o} value={o}>Lote {o}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Sin datos ── */}
      {!resLote ? (
        <div className="agl-vacio">
          <p>Seleccione un GF y Lote para ver el análisis.</p>
        </div>
      ) : (
        <div className="agl-scroll">

          {/* ── Gráfico del Lote ── */}
          <div className="agl-grafico-card">
            <p className="agl-grafico-titulo">Lote {filtroLote}</p>
            <div className="agl-grafico-barras">
              {(() => {
                const maxCajas = Math.max(...TAMANO_KEYS.map((k) => resLote.cajasPorTam[k]));
                return TAMANO_KEYS.map((k) => {
                  const val    = Math.round(resLote.cajasPorTam[k]);
                  const altura = maxCajas > 0 ? Math.max(2, Math.round((val / maxCajas) * 100)) : 0;
                  return (
                    <div key={k} className="agl-barra-item">
                      <span className="agl-barra-valor">{val.toLocaleString('es-CR')}</span>
                      <div
                        className="agl-barra"
                        style={{
                          height: `${altura}%`,
                          background: COLOR_FONDO[k],
                        }}
                      />
                      <span className="agl-barra-label">T{k}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* ── Resumen en una línea ── */}
          <div className="agl-resumen">
            <div className="agl-resumen-celda">
              <span className="agl-resumen-label">Cajas Exp :</span>
              <span className="agl-resumen-val">{fmt(resLote.cajasExport)}</span>
            </div>
            <div className="agl-resumen-celda">
              <span className="agl-resumen-label">Cajas No Exp</span>
              <span className="agl-resumen-val">{fmt(resLote.cajasNoEmp)}</span>
            </div>
            <div className="agl-resumen-celda">
              <span className="agl-resumen-label">Cajas / Ha</span>
              <span className="agl-resumen-val">{fmt(resLote.cajasHa)}</span>
            </div>
          </div>

          {/*
            Aclaración: este total se calcula combinando las muestras crudas
            (tamaños + defectos) de TODAS las parcelas del lote y proyectando
            una sola vez sobre ese combinado — no es la suma de las filas de
            abajo, que cada una tiene su propio % de empaque. Ver CODEX
            "Auditoría de Motores de Cálculo", bug #3.
          */}
          <p className="agl-resumen-nota">
            Total del lote (muestras combinadas) — no es la suma de las parcelas de abajo
          </p>

          {/* ── Detalle por parcela ── */}
          <div className="agl-detalle">
            {detalleParcelas.map((p) => (
              <div key={p.id} className="agl-parcela-row">

                {/* Cabecera de la fila */}
                <div className="agl-parcela-header">
                  <span className="agl-ph-label">Cos</span>
                  <span className="agl-ph-label">Lot - Par</span>
                  <span className="agl-ph-label">Ha</span>
                  <span className="agl-ph-label">Cajas</span>
                  <span className="agl-ph-label">Cajas/Ha</span>
                  <span />
                  <span />
                </div>

                {/* Datos de la fila */}
                <div className="agl-parcela-data">
                  <span className="agl-pd-cos">{p.cosecha}</span>
                  <span className="agl-pd-lotpar">{p.lote}-{p.parcela}</span>
                  <span className="agl-pd-val">{p.area.toFixed(2)}</span>
                  <span className="agl-pd-val">{fmt(p.cajasExport)}</span>
                  <span className="agl-pd-val">{fmt(p.cajasHa)}</span>
                  <span
                    className="agl-indicador"
                    style={{ background: colorIndicador(p.cajasHa) }}
                  />
                  <button
                    className="agl-btn-grafico"
                    onClick={() => {
                      console.log('NAVEGANDO A DETALLE PARCELA:', p.id);
                      navigate(`/estimaciones/analisis/parcela/${p.id}`, {
                        state: {
                          gfFijado: gfFijado ?? filtroGF,
                          lote: p.lote,
                          parcela: p.parcela,
                        },
                      });
                    }}
                    aria-label="Ver análisis detalle de parcela"
                    title="Ver análisis detalle de parcela"
                  >
                    📈
                  </button>
                </div>

              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
