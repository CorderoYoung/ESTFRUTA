const TAMANO_KEYS = [5, 6, 7, 8, 9, 10, 11, 12];

function sumTamanos(tamanos) {
  return TAMANO_KEYS.reduce((sum, key) => {
    const value = tamanos?.[key];
    return sum + (typeof value === 'number' ? value : Number(value) || 0);
  }, 0);
}

function sumDefectos(defectos) {
  if (!defectos || typeof defectos !== 'object') {
    return 0;
  }

  return Object.values(defectos).reduce((sum, value) => {
    return sum + (typeof value === 'number' ? value : Number(value) || 0);
  }, 0);
}

function roundFinal(value) {
  return Math.round(value);
}

export function calcularEstimacion(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Input inválido para calcularEstimacion');
  }

  const empacables = sumTamanos(input.tamanos);
  const noEmpacables = sumDefectos(input.defectos);
  const totalMuestra = empacables + noEmpacables;

  const porcentajeEmpacable =
    totalMuestra === 0 ? 0 : empacables / totalMuestra;

  const frutaEmpacableTotal = input.ptasEst * porcentajeEmpacable;

  const frutasPorTamano = {};
  const cajasPorTamano = {};

  TAMANO_KEYS.forEach((key) => {
    const cantidadTamano =
      typeof input.tamanos?.[key] === 'number'
        ? input.tamanos[key]
        : Number(input.tamanos?.[key]) || 0;

    const frutaTamano =
      empacables === 0
        ? 0
        : frutaEmpacableTotal * (cantidadTamano / empacables);

    frutasPorTamano[key] = frutaTamano;
    cajasPorTamano[key] = frutaTamano / key;
  });

  const totalCajas = roundFinal(
    TAMANO_KEYS.reduce((sum, key) => sum + (cajasPorTamano[key] || 0), 0)
  );

  const cajasNoEmpacables = roundFinal(
    ((1 - porcentajeEmpacable) * input.ptasEst) / 8
  );

  const cajasHaEmpacables = roundFinal(
    input.area === 0 ? 0 : totalCajas / input.area
  );

  const cajasHaNoEmpacables = roundFinal(
    input.area === 0 ? 0 : cajasNoEmpacables / input.area
  );

  const totalCajasGeneral =
    totalCajas + cajasNoEmpacables;

  const cajasHaTotal = roundFinal(
    input.area === 0 ? 0 : totalCajasGeneral / input.area
  );

  return {
    empacables,
    noEmpacables,
    totalMuestra,
    porcentajeEmpacable,
    frutaEmpacableTotal,

    frutasPorTamano,
    cajasPorTamano,

    // Cajas empacables
    totalCajas,
    cajasPorHectarea: cajasHaEmpacables,
    cajasHaEmpacables,

    // Cajas no empacables
    cajasNoEmpacables,
    cajasHaNoEmpacables,

    // Total general
    totalCajasGeneral,
    cajasHaTotal,
  };
}

/**
 * Motor único de proyección de cajas — fuente de verdad para
 * PantallaEstimacionPorGF.js (calcularGF), PantallaAnalisisGF_Lote.js
 * (calcularAgrupado y calcularParcela) y PantallaAnalisisParcelaDetalle.jsx
 * (calcular). Ver CODEX "Auditoría de Motores de Cálculo — 2026-07-28"
 * para la decisión y su justificación.
 *
 * Acepta tamanos/defectos ya agregados (uno o varios documentos combinados)
 * en vez de un array `detalle` crudo, porque los 4 call-sites ya traen esos
 * totales pre-sumados desde su propio extraerMuestras().
 *
 * REGLA DE REDONDEO (no negociable): `totalCajas` es SIEMPRE
 * round(Σ cajas por tamaño sin redondear) — el único valor válido para KPI
 * ("Cajas Exp") y para el color de Cajas/Ha. `cajasRedondeadasPorTamano` es
 * el desglose por tamaño ya redondeado, SOLO para pintar la tabla T5–T12;
 * nunca sumar esos valores para obtener un total — eso fue exactamente el
 * bug que causaba cifras y colores distintos entre pantallas.
 *
 * @param {Object} params
 * @param {Object} params.tamanos - { 5:n, 6:n, ..., 12:n } cantidades empacables por tamaño (ya agregadas)
 * @param {number} params.totalDefectos - cantidad total de frutas no empacables (ya agregada, escalar)
 * @param {number} params.ptasEst - plantas en estación (o acumuladas si son varios documentos)
 * @param {number} params.area - hectáreas (o acumuladas si son varios documentos)
 */
export function proyectarCajas({ tamanos, totalDefectos, ptasEst, area }) {
  const empacables = TAMANO_KEYS.reduce((sum, key) => {
    const value = tamanos?.[key];
    return sum + (typeof value === 'number' ? value : Number(value) || 0);
  }, 0);

  const noEmpacables = Number(totalDefectos) || 0;
  const totalMuestra = empacables + noEmpacables;

  const porcentajeEmpacable =
    totalMuestra === 0 ? 0 : empacables / totalMuestra;

  const ptasEstNum = Number(ptasEst) || 0;
  const frutaEmpacableTotal = ptasEstNum * porcentajeEmpacable;

  const cajasPorTamano = {};
  const cajasRedondeadasPorTamano = {};

  TAMANO_KEYS.forEach((key) => {
    const cantidadTamano =
      typeof tamanos?.[key] === 'number'
        ? tamanos[key]
        : Number(tamanos?.[key]) || 0;

    const frutaTamano =
      empacables === 0
        ? 0
        : frutaEmpacableTotal * (cantidadTamano / empacables);

    cajasPorTamano[key] = frutaTamano / key;
    cajasRedondeadasPorTamano[key] = roundFinal(cajasPorTamano[key]);
  });

  // Único criterio válido para KPI y color: redondeo al final del agregado
  // continuo. NO sumar cajasRedondeadasPorTamano — ver nota arriba.
  const totalCajas = roundFinal(
    TAMANO_KEYS.reduce((sum, key) => sum + (cajasPorTamano[key] || 0), 0)
  );

  const areaNum = Number(area) || 0;

  const cajasNoEmpacables = roundFinal(
    ((1 - porcentajeEmpacable) * ptasEstNum) / 8
  );

  const cajasHaEmpacables = roundFinal(
    areaNum === 0 ? 0 : totalCajas / areaNum
  );

  const cajasHaNoEmpacables = roundFinal(
    areaNum === 0 ? 0 : cajasNoEmpacables / areaNum
  );

  const totalCajasGeneral = totalCajas + cajasNoEmpacables;

  const cajasHaTotal = roundFinal(
    areaNum === 0 ? 0 : totalCajasGeneral / areaNum
  );

  return {
    porcentajeEmpacable,

    cajasPorTamano,             // sin redondear — uso interno
    cajasRedondeadasPorTamano,  // redondeado por tamaño — SOLO para pintar tabla, nunca sumar como total

    totalCajas,                 // KPI canónico "Cajas Exp" (empacables)
    cajasHaEmpacables,

    cajasNoEmpacables,
    cajasHaNoEmpacables,

    totalCajasGeneral,
    cajasHaTotal,
  };
}

export function pruebaEstimacion() {
  const input = {
    ptasEst: 44379,
    area: 0.75,
    tamanos: {
      5: 0,
      6: 350,
      7: 647,
      8: 386,
      9: 253,
      10: 300,
      11: 250,
      12: 100,
    },
    defectos: {
      Muerta: 144,
      Forza: 6,
      Enferma: 28,
      Peque: 1,
      NDF: 115,
      Eriza: 4,
      Sombra: 1,
      Quebrada: 52,
      Cicatriz: 2,
      Doble: 7,
      Torcida: 12,
      Elaphria: 2,
    },
  };

  const resultado = calcularEstimacion(input);

  console.log('Empacables:', resultado.empacables);
  console.log('NoEmpacables:', resultado.noEmpacables);
  console.log('TotalMuestra:', resultado.totalMuestra);
  console.log('PorcentajeEmpacable:', resultado.porcentajeEmpacable);
  console.log('FrutaEmpacableTotal:', resultado.frutaEmpacableTotal);
  console.log('FrutasPorTamano:', resultado.frutasPorTamano);
  console.log('CajasPorTamano:', resultado.cajasPorTamano);

  console.log('TotalCajas Empacables:', resultado.totalCajas);
  console.log('CajasHa Empacables:', resultado.cajasHaEmpacables);

  console.log('CajasNoEmpacables:', resultado.cajasNoEmpacables);
  console.log('CajasHa No Empacables:', resultado.cajasHaNoEmpacables);

  console.log('TotalCajas General:', resultado.totalCajasGeneral);
  console.log('CajasHa Total:', resultado.cajasHaTotal);

  return resultado;
}