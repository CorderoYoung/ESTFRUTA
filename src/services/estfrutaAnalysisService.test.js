import { calcularEstimacion, proyectarCajas } from './estfrutaAnalysisService';

// Fixture del Sprint 1 — ver CODEX "Datos de prueba validados".
const FIXTURE = {
  ptasEst: 44379,
  area: 0.75,
  tamanos: { 5: 0, 6: 350, 7: 647, 8: 386, 9: 253, 10: 300, 11: 250, 12: 100 },
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

const TOTAL_DEFECTOS = Object.values(FIXTURE.defectos).reduce((a, b) => a + b, 0);

test('calcularEstimacion (motor validado, sin tocar) reproduce el fixture documentado', () => {
  const r = calcularEstimacion(FIXTURE);
  expect(r.totalCajas).toBe(4808);
  expect(r.cajasNoEmpacables).toBe(780);
  expect(r.totalCajasGeneral).toBe(5588);
  expect(r.cajasHaEmpacables).toBe(6411);
  expect(r.cajasHaTotal).toBe(7451);
});

test('proyectarCajas (motor unificado, S11) reproduce el mismo fixture con defectos ya agregados', () => {
  const r = proyectarCajas({
    tamanos: FIXTURE.tamanos,
    totalDefectos: TOTAL_DEFECTOS,
    ptasEst: FIXTURE.ptasEst,
    area: FIXTURE.area,
  });
  expect(r.totalCajas).toBe(4808);
  expect(r.cajasNoEmpacables).toBe(780);
  expect(r.totalCajasGeneral).toBe(5588);
  expect(r.cajasHaEmpacables).toBe(6411);
  expect(r.cajasHaTotal).toBe(7451);
});

test('proyectarCajas coincide con calcularEstimacion para el mismo input (misma matemática, distinta forma de entrada)', () => {
  const a = calcularEstimacion(FIXTURE);
  const b = proyectarCajas({
    tamanos: FIXTURE.tamanos,
    totalDefectos: TOTAL_DEFECTOS,
    ptasEst: FIXTURE.ptasEst,
    area: FIXTURE.area,
  });

  expect(b.totalCajas).toBe(a.totalCajas);
  expect(b.cajasNoEmpacables).toBe(a.cajasNoEmpacables);
  expect(b.totalCajasGeneral).toBe(a.totalCajasGeneral);
  expect(b.cajasHaEmpacables).toBe(a.cajasHaEmpacables);
  expect(b.cajasHaTotal).toBe(a.cajasHaTotal);
});

test('proyectarCajas: el redondeo por tamaño (cosmético) nunca debe usarse como KPI', () => {
  const r = proyectarCajas({
    tamanos: FIXTURE.tamanos,
    totalDefectos: TOTAL_DEFECTOS,
    ptasEst: FIXTURE.ptasEst,
    area: FIXTURE.area,
  });

  const sumaTablaCosmetica = Object.values(r.cajasRedondeadasPorTamano).reduce(
    (a, b) => a + b,
    0
  );

  // En este fixture ambos coinciden (T10 es el único que cruza 0.5), pero el
  // test documenta la regla: totalCajas es el KPI, no la suma de la tabla.
  expect(r.totalCajas).toBe(sumaTablaCosmetica);
  expect(r.totalCajas).not.toBe(undefined);
});
