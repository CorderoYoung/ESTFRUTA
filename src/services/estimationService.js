import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { validateEstimationCreatePayload, deriveGf } from '../domain/estimationBusinessRules';
import { validateEstimationHeader } from '../domain/estimationHeaderRules';
import { crearUniqueKey } from './operationalDraftStorage';

/**
 * Consulta Firestore para ver si ya existe un documento con el mismo uniqueKey.
 * Devuelve el id del documento existente, o null si no hay duplicado.
 *
 * @param {string}      uniqueKey  - Clave canónica a buscar
 * @param {string|null} excludeId  - Id de documento a ignorar (modo edición)
 * @returns {Promise<string|null>}
 */
async function checkFirebaseDuplicate(uniqueKey, excludeId = null) {
  if (!uniqueKey) return null;
  const q = query(
    collection(db, 'estimaciones'),
    where('uniqueKey', '==', uniqueKey)
  );
  const snap = await getDocs(q);
  for (const docSnap of snap.docs) {
    if (excludeId && docSnap.id === excludeId) continue;
    return docSnap.id; // duplicate found
  }
  return null;
}

export async function requestCreateEstimation(draft) {
  console.log('[estimationService] requestCreateEstimation start', { draft });

  // avoid carrying legacy lowercase `gf` into Firebase
  if (draft && Object.prototype.hasOwnProperty.call(draft, 'gf')) {
    draft = { ...draft };
    delete draft.gf;
  }

  const isHeaderOnly = !Array.isArray(draft?.detalle) || draft.detalle.length === 0;

  if (isHeaderOnly) {
    const headerValidation = validateEstimationHeader(draft);
    if (!headerValidation.ok) {
      console.log('[estimationService] header validation failed', headerValidation.errors);
      return {
        success: false,
        errors: headerValidation.errors,
      };
    }

    // --- Duplicate check (header-only / new record) ---
    const headerUniqueKey = crearUniqueKey({
      ...draft,
      GF: deriveGf(draft.Forza ?? draft.forza, draft.Semana ?? draft.semana) || '',
    });
    const existingHeaderId = await checkFirebaseDuplicate(headerUniqueKey);
    if (existingHeaderId) {
      console.log('[estimationService] duplicate detected (header-only)', { headerUniqueKey, existingHeaderId });
      return {
        success: false,
        errors: ['Ya existe una estimación para esta Cosecha, Tipo, GF, Lote, Parcela y Año.'],
        isDuplicate: true,
      };
    }
    // --- End duplicate check ---

    const dbPayload = {
      cosecha: draft.Cosecha ?? draft.cosecha,
      tipo: draft.Tipo ?? draft.tipo,
      semana: Number(draft.Semana) || 0,
      forza: Number(draft.Forza) || 0,
      lote: Number(draft.Lote) || 0,
      parcela: Number(draft.Parcela) || 0,
      poblacion: Number(draft.Poblacion) || 0,
      ptasEstac: Number(draft.PtasEstac) || 0,
      ptasMues: Number(draft.PtasMues) || 0,
      area: Number(draft.Area) || 0,
      GF: deriveGf(draft.Forza ?? draft.forza, draft.Semana ?? draft.semana) || '',
      uniqueKey: headerUniqueKey,
      anio: new Date().getFullYear(),
      createdAt: new Date().toISOString(),
      isHeaderOnly: true,
    };

    console.log('DBPAYLOAD CRUDO:', dbPayload);
    console.log('GF MINUSCULA:', dbPayload.gf);
    console.log('GF MAYUSCULA:', dbPayload.GF);

    const payload = { ...dbPayload };
    console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(payload, null, 2));
    console.log('GF MINUSCULA:', payload.gf);

    const finalDbPayload = { ...payload };
    if ('gf' in finalDbPayload) {
      delete finalDbPayload.gf;
    }
    console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(finalDbPayload, null, 2));

    try {
      console.log(
                    'PAYLOAD EXACTO ENVIADO A FIREBASE:',
                    JSON.parse(JSON.stringify(finalDbPayload))
                  );

                  throw new Error(
                    JSON.stringify(finalDbPayload, null, 2)
                  );
      

      

      

      
    } catch (exception) {
      console.error('[estimationService] firebase insert exception', exception);
      return {
        success: false,
        errors: [exception?.message || 'Unexpected Firebase error'],
      };
    }
  }

  const validation = validateEstimationCreatePayload(draft);
  if (!validation.ok) {
    console.log('[estimationService] full payload validation failed', validation.errors);
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // --- Duplicate check (full payload / update existing header doc) ---
  const fullUniqueKey = crearUniqueKey({
    ...draft,
    GF: validation.derivedGF || deriveGf(draft.Forza ?? draft.forza, draft.Semana ?? draft.semana) || '',
  });
  const existingFullId = await checkFirebaseDuplicate(fullUniqueKey, draft.estimationId ?? null);
  if (existingFullId) {
    console.log('[estimationService] duplicate detected (full payload)', { fullUniqueKey, existingFullId });
    return {
      success: false,
      errors: ['Ya existe una estimación para esta Cosecha, Tipo, GF, Lote, Parcela y Año.'],
      isDuplicate: true,
    };
  }
  // --- End duplicate check ---

  const dbPayload = {
    cosecha: draft.Cosecha ?? draft.cosecha,
    tipo: draft.Tipo ?? draft.tipo,
    
    semana: Number(draft.Semana) || 0,
    forza: Number(draft.Forza) || 0,
    lote: Number(draft.Lote) || 0,
    parcela: Number(draft.Parcela) || 0,
    poblacion: Number(draft.Poblacion) || 0,
    ptasEstac: Number(draft.PtasEstac) || 0,
    ptasMues: Number(draft.PtasMuestras ?? draft.PtasMues) || 0,
    area: Number(draft.Area) || 0,
    // Sampling data
    detalle: Array.isArray(draft.detalle) ? draft.detalle : [],
    frutasEmpacables: validation.aggregates?.frutasEmpacables || 0,
    frutasNoEmpacables: validation.aggregates?.frutasNoEmpacables || 0,
    frutasTotales: validation.aggregates?.frutasTotales || 0,
    // Timestamps and metadata
    createdAt: new Date().toISOString(),
    isHeaderOnly: false,
    GF: validation.derivedGF || deriveGf(draft.Forza ?? draft.forza, draft.Semana ?? draft.semana) || '',
    uniqueKey: fullUniqueKey,
    anio: new Date().getFullYear(),
  };

  const payload = { ...dbPayload };
        console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(payload, null, 2));
        console.log('GF MINUSCULA:', payload.gf);

        const finalDbPayload = {
        ...payload,
        gf: payload.gf || null,
      };

        delete finalDbPayload.gf;

  console.log('FINAL PAYLOAD LIMPIO:', finalDbPayload);

  console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(finalDbPayload, null, 2));

  try {
    delete finalDbPayload.gf;
    delete finalDbPayload.GF;

    console.log('PAYLOAD LIMPIO:', finalDbPayload);
    console.log(
              'FINAL STRING:',
              JSON.stringify(finalDbPayload, null, 2)
            );
    console.log('DRAFT COMPLETO:', draft);
    console.log('ESTIMATION ID:', draft.estimationId);
    await updateDoc(
        doc(db, 'estimaciones', draft.estimationId),
        finalDbPayload
      );

      console.log('[estimationService] firebase update ok', {
        docId: draft.estimationId,
      });

    const outPayload = { ...draft };
    if (Object.prototype.hasOwnProperty.call(outPayload, 'gf')) delete outPayload.gf;
    outPayload.FrutasEmpacables = validation.aggregates.frutasEmpacables;
    outPayload.FrutasNoEmpacables = validation.aggregates.frutasNoEmpacables;
    outPayload.FrutasTotales = validation.aggregates.frutasTotales;
    outPayload.GF = validation.derivedGF || deriveGf(draft.Forza ?? draft.forza, draft.Semana ?? draft.semana) || '';

    return {
        success: true,
        payload: outPayload,
        estimationId: draft.estimationId,
      };
  } catch (exception) {
    console.error('[estimationService] firebase insert exception', exception);
    return {
      success: false,
      errors: [exception?.message || 'Unexpected Firebase error'],
    };
  }
}

/**
 * Update an existing estimation document in Firestore (for EstimationSamplingEditPage)
 * @param {string} docId - Document ID from Firestore
 * @param {object} draft - Updated data payload
 */
export async function requestUpdateEstimation(docId, draft) {
  console.log('[estimationService] requestUpdateEstimation start', { docId, draft });

  // avoid persisting legacy lowercase gf
  if (draft && Object.prototype.hasOwnProperty.call(draft, 'gf')) {
    draft = { ...draft };
    delete draft.gf;
  }

  const validation = validateEstimationCreatePayload(draft);
  if (!validation.ok) {
    console.log('[estimationService] update validation failed', validation.errors);
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // --- Duplicate check (edit mode: exclude current docId) ---
  const updateUniqueKey = crearUniqueKey({
    ...draft,
    GF: validation.derivedGF || deriveGf(draft.Forza ?? draft.forza, draft.Semana ?? draft.semana) || '',
  });
  const existingUpdateId = await checkFirebaseDuplicate(updateUniqueKey, docId);
  if (existingUpdateId) {
    console.log('[estimationService] duplicate detected (update)', { updateUniqueKey, existingUpdateId });
    return {
      success: false,
      errors: ['Ya existe una estimación para esta Cosecha, Tipo, GF, Lote, Parcela y Año.'],
      isDuplicate: true,
    };
  }
  // --- End duplicate check ---

  const dbPayload = {
    cosecha: draft.Cosecha ?? draft.cosecha,
    tipo: draft.Tipo ?? draft.tipo,
    
    semana: Number(draft.Semana) || 0,
    forza: Number(draft.Forza) || 0,
    lote: Number(draft.Lote) || 0,
    parcela: Number(draft.Parcela) || 0,
    poblacion: Number(draft.Poblacion) || 0,
    ptasEstac: Number(draft.PtasEstac) || 0,
    ptasMues: Number(draft.PtasMuestras ?? draft.PtasMues) || 0,
    area: Number(draft.Area) || 0,
    // Sampling data
    detalle: Array.isArray(draft.detalle) ? draft.detalle : [],
    frutasEmpacables: validation.aggregates?.frutasEmpacables || 0,
    frutasNoEmpacables: validation.aggregates?.frutasNoEmpacables || 0,
    frutasTotales: validation.aggregates?.frutasTotales || 0,
    // Timestamps and metadata
    updatedAt: new Date().toISOString(),
    GF: validation.derivedGF || deriveGf(draft.Forza ?? draft.forza, draft.Semana ?? draft.semana) || '',
    uniqueKey: updateUniqueKey,
    anio: new Date().getFullYear(),
  };

  const payload = { ...dbPayload };
  console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(payload, null, 2));
  console.log('GF MINUSCULA:', payload.gf);

  const finalDbPayload = { ...payload };console.log('DRAFT COMPLETO:', draft);
  finalDbPayload.detalle = draft.detalle || [];
  if ('gf' in finalDbPayload) {
    delete finalDbPayload.gf;
  }
  console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(finalDbPayload, null, 2));

  try {
    const docRef = doc(db, 'estimaciones', docId);
    await updateDoc(docRef, finalDbPayload);
    console.log('[estimationService] firebase update result', { docId });

    return {
      success: true,
      payload: {
        ...draft,
        
        FrutasEmpacables: validation.aggregates.frutasEmpacables,
        FrutasNoEmpacables: validation.aggregates.frutasNoEmpacables,
        FrutasTotales: validation.aggregates.frutasTotales,
        GF: validation.derivedGF || deriveGf(draft.Forza ?? draft.forza, draft.Semana ?? draft.semana) || '',
      },
      docId,
    };
  } catch (exception) {
    console.error('[estimationService] firebase update exception', exception);
    return {
      success: false,
      errors: [exception?.message || 'Unexpected Firebase error'],
    };
  }
}