import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig.js';
import { calcularEstimacion } from '../services/estfrutaAnalysisService';
import './PantallaEstimacionPorSeccion.css';

const tamanosKeys = [5, 6, 7, 8, 9, 10, 11, 12];

// datosPrueba eliminado — ahora se lee desde Firebase

function formatoNumero(valor) {
  return Math.round(Number(valor || 0)).toLocaleString('es-CR');
}

function formatoArea(valor) {
  return Number(valor || 0).toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PantallaEstimacionPorSeccion({ user, onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [cabecera, setCabecera] = useState(null);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    async function cargarEstimacion() {
      try {
        setCargando(true);
        const docRef = doc(db, 'estimaciones', id);
        const docSnap = await getDoc(docRef);

        // 2026-11-07: un registro anulado se trata como no encontrado.
        if (!docSnap.exists() || docSnap.data()?.anulado === true) {
          setError('Estimación no encontrada');
          return;
        }

        const data = docSnap.data();

        // Normalizar cabecera usando misma estructura que EstimationSamplingEditPage
        const cab = {
          tipo:      data.Tipo      || data.tipo      || '',
          cosecha:   data.Cosecha   || data.cosecha   || data.pc || '',
          semana:    data.Semana    || data.semana     || '',
          forza:     data.Forza     || data.forza      || '',
          lote:      data.Lote      || data.lote       || '',
          parcela:   data.Parcela   || data.parcela    || data.seccion || '',
          poblacion: data.Poblacion || data.poblacion  || 0,
          ptasEst:   Number(data.PtasEstac  || data.ptasEstac  || data.ptasEst  || 0),
          ptasMues:  Number(data.PtasMues   || data.ptasMues   || 0),
          area:      Number(data.Area       || data.area       || 0),
          gf:        data.GF        || data.gf         || '',
        };

        // Construir objeto para calcularEstimacion
        const tamanos = {};
        const defectos = {};

        if (Array.isArray(data.detalle)) {
          data.detalle.forEach(({ tipoLinea, codigoClasificacion, cantidadDelta }) => {
            const cantidad = Number(cantidadDelta) || 0;
            if (tipoLinea === 'TAMANO') {
              tamanos[Number(codigoClasificacion)] = cantidad;
            } else if (tipoLinea === 'DEFECTO') {
              defectos[codigoClasificacion] = cantidad;
            }
          });
        }

        const inputCalculo = {
          ptasEst: cab.ptasEst,
          area:    cab.area,
          tamanos,
          defectos,
        };

        setCabecera(cab);
        setResultado(calcularEstimacion(inputCalculo));
      } catch (err) {
        console.error('Error cargando estimación:', err);
        setError('Error al cargar la estimación');
      } finally {
        setCargando(false);
      }
    }

    if (id) cargarEstimacion();
  }, [id]);

  if (cargando) return <div style={{ padding: 32, textAlign: 'center' }}>Cargando...</div>;
  if (error)    return <div style={{ padding: 32, color: 'red' }}>{error}</div>;
  if (!cabecera || !resultado) return null;

  const totalCajasGeneral   = resultado.totalCajasGeneral;
  const cajasHaTotal        = resultado.cajasHaTotal;
  const cajasHaNoEmpacables = resultado.cajasHaNoEmpacables;
  const cajasHaEmpacables   = resultado.cajasHaEmpacables;

  const colorCajasHaEmpacables =
  cajasHaEmpacables >= 7500
    ? '#16a34a'     // Verde
    : cajasHaEmpacables >= 5500
      ? '#f59e0b'   // Naranja
      : '#dc2626';  // Rojo

  const totalCajasTamano = tamanosKeys.reduce(
        (sum, key) => sum + (resultado.cajasPorTamano[key] || 0),
        0
      );

      const porcentajePorTamano = {};

      tamanosKeys.forEach((key) => {
        porcentajePorTamano[key] =
          totalCajasTamano > 0
            ? ((resultado.cajasPorTamano[key] || 0) / totalCajasTamano) * 100
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

  return (
    <div className="estimacion-seccion-page">
      <header className="estimacion-seccion-header">
        <button type="button" className="estimacion-back-button" onClick={() => navigate(-1)}>
          ←
        </button>

        <div>
          <h1>Estimación de Cajas</h1>
          <h2>
            Lote {cabecera.lote} Parcela {cabecera.parcela}
          </h2>
        </div>

        
      </header>

      <section className="estimacion-info-grid">
        <div>
          <span>Tipo</span>
          <strong>{cabecera.tipo}</strong>
        </div>
        <div>
          <span>Cos</span>
          <strong>{cabecera.cosecha}</strong>
        </div>
        <div>
          <span>Semana</span>
          <strong>{cabecera.semana}</strong>
        </div>
        <div>
          <span>Forza</span>
          <strong>{cabecera.forza}</strong>
        </div>
        <div>
          <span>Lote</span>
          <strong>{cabecera.lote}</strong>
        </div>
        <div>
          <span>Parcela</span>
          <strong>{cabecera.parcela}</strong>
        </div>
        <div>
          <span>Población</span>
          <strong>{formatoNumero(cabecera.poblacion)}</strong>
        </div>
        <div>
          <span>PtasEstacion</span>
          <strong>{formatoNumero(cabecera.ptasEst)}</strong>
        </div>
        <div>
          <span>PtasMuestras</span>
          <strong>{formatoNumero(cabecera.ptasMues)}</strong>
        </div>
        <div>
          <span>Area</span>
          <strong>{formatoArea(cabecera.area)}</strong>
        </div>
      </section>

      

      <section className="estimacion-resumen">
        <div className="resumen-row resumen-total">
          <span>Total Cajas</span>
          <strong>{formatoNumero(totalCajasGeneral)}</strong>
          <span>Cajas / Hectarea</span>
          <strong>{formatoNumero(cajasHaTotal)}</strong>
        </div>

        <div className="resumen-row resumen-no-emp">
          <span>Cajas No Empacables</span>
          <strong>{formatoNumero(resultado.cajasNoEmpacables)}</strong>
          <span>Cajas / Hectarea</span>
          <strong>{formatoNumero(cajasHaNoEmpacables)}</strong>
        </div>

        <div className="resumen-row resumen-emp">
          <span>Cajas Empacables</span>
          <strong>{formatoNumero(resultado.totalCajas)}</strong>
          <span>Cajas / Hectarea</span>
          <strong
                style={{
                  color: colorCajasHaEmpacables,
                  fontWeight: 800,
                }}
              >
                {formatoNumero(cajasHaEmpacables)}
          </strong>
        </div>
      </section>

      <section className="estimacion-tamanos-grid">
        {tamanosKeys.map((key) => (
          <div key={key} className={`tamano-card tamano-${key}`}>
            <span>T{key}</span>
            <strong>{formatoNumero(resultado.cajasPorTamano[key])}</strong>
          </div>
        ))}
      </section>

      <section className="estimacion-grafico">
        <h3>Distribución Curva de Tamaños (%)</h3>

        <div className="grafico-barras">
          {tamanosKeys.map((key) => {
            const valor = porcentajePorTamano[key] || 0;
            const maxPct = Math.max(
              ...tamanosKeys.map((k) => porcentajePorTamano[k] || 0)
            );

            const altura =
              maxPct > 0
                ? Math.max(2, Math.round((valor / maxPct) * 85))
                : 0;

            return (
              <div key={key} className="barra-item">
                <span className="barra-valor">{Math.round(valor)}</span>

                <div
                  className={`barra barra-${key}`}
                  style={{ height: `${altura}%` }}
                />

                <span className="barra-label">T{key}</span>
              </div>
            );
          })}
        </div>

        <div className="gf-grupos">
          <div className="gf-grupo">
            <span className="gf-grupo-label">Grandes</span>
            <strong className="gf-grupo-pct">{Math.round(grupoGrandes)}%</strong>
          </div>

          <div className="gf-grupo">
            <span className="gf-grupo-label">Intermedios</span>
            <strong className="gf-grupo-pct">{Math.round(grupoIntermedios)}%</strong>
          </div>

          <div className="gf-grupo">
            <span className="gf-grupo-label">Pequeños</span>
            <strong className="gf-grupo-pct">{Math.round(grupoPequenos)}%</strong>
          </div>
        </div>
      </section>
    </div>
  );
}