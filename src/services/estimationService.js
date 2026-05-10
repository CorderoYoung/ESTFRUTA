import { validateEstimationCreatePayload } from '../domain/estimationBusinessRules';

/**
 * Capa de aplicación: aquí irá POST a SQL/API.
 * Backend (Node + SQL Server): recibir `detalle`, recalcular agregados con la misma
 * función que la UI (o SQL equivalente), rechazar si FrutasTotales !== PtasMuestras.
 * No persistir FrutasTotales enviado por el cliente sin recalcular.
 */
export async function requestCreateEstimation(draft) {
  const validation = validateEstimationCreatePayload(draft);
  if (!validation.ok) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // Futuro: POST con detalle; servidor recalcula FrutasTotales y valida == PtasMuestras.
  // const body = { ...draft, GF: validation.derivedGF, ...validation.aggregates };
  return {
    success: true,
    payload: {
      ...draft,
      GF: validation.derivedGF,
      FrutasEmpacables: validation.aggregates.frutasEmpacables,
      FrutasNoEmpacables: validation.aggregates.frutasNoEmpacables,
      FrutasTotales: validation.aggregates.frutasTotales,
    },
  };
}
