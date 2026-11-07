import React, { useMemo, useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import useOffline from '../hooks/useOffline';
import { db } from '../firebaseConfig';

import { deriveGf } from '../domain/estimationBusinessRules';
import { validateEstimationHeader } from '../domain/estimationHeaderRules';
import { requestCreateEstimation } from '../services/estimationService';
import {
  draftHasSamplingProgress,
  getHeaderFingerprint,
  crearUniqueKey,
  // loadOperationalDraft, // PHASE 2: Draft loading disabled
} from '../services/operationalDraftStorage';
import { puedeEditar, PANTALLAS } from '../constants/permissions';

const SESSION_KEY = 'estfruta_session_user';

const emptyHeader = {
  Cosecha: '',
  Tipo: '',
  Semana: '',
  Forza: '',
  Lote: '',
  Parcela: '',
  Poblacion: '',
  PtasEstac: '',
  PtasMues: '',
  Area: '',
  GF: '',
};

const normalizeDuplicateValue = (value) => String(value ?? '').trim().toUpperCase();

const getComparableHeader = (record) => record?.header ?? record?.encabezado ?? record;

const getYearFromDateValue = (value) => {
  if (!value) return '';

  if (typeof value?.toDate === 'function') {
    return value.toDate().getFullYear();
  }

  if (value instanceof Date) {
    return value.getFullYear();
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).getFullYear();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.getFullYear();
};

const getComparableYear = (record) => {
  const candidate = getComparableHeader(record);
  const explicitYear =
    candidate?.anio ??
    candidate?.Anio ??
    candidate?.Año ??
    candidate?.year ??
    candidate?.Year ??
    record?.anio ??
    record?.Anio ??
    record?.Año ??
    record?.year ??
    record?.Year;

  if (explicitYear) return explicitYear;

  return getYearFromDateValue(candidate?.fechaCreacion ?? record?.fechaCreacion);
};

const sameEstimationWithoutGF = (targetHeader, record) => {
  const candidate = getComparableHeader(record);

  return (
    normalizeDuplicateValue(candidate?.Cosecha) === normalizeDuplicateValue(targetHeader?.Cosecha) &&
    normalizeDuplicateValue(candidate?.Tipo) === normalizeDuplicateValue(targetHeader?.Tipo) &&
    normalizeDuplicateValue(candidate?.Lote) === normalizeDuplicateValue(targetHeader?.Lote) &&
    normalizeDuplicateValue(candidate?.Parcela) === normalizeDuplicateValue(targetHeader?.Parcela) &&
    normalizeDuplicateValue(getComparableYear(record)) ===
      normalizeDuplicateValue(getComparableYear(targetHeader))
  );
};

const duplicateWithoutGFExists = (targetHeader, records) =>
  Array.isArray(records) && records.some((record) => sameEstimationWithoutGF(targetHeader, record));

export default function EstimationHeaderPage({ user, onLogout }) {
  const navigate = useNavigate();
  const { isOnline, guardarRegistroLocal, registrosLocales = [] } = useOffline();
  const [header, setHeader] = useState({ ...emptyHeader });

  // Resolver rol: usar prop user si existe, sino leer desde localStorage
  const resolvedUser = user ?? (() => {
    try {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return parsed?.Usuario && parsed?.Rol ? parsed : null;
    } catch {
      return null;
    }
  })();

  const rol = resolvedUser?.Rol;

  // Muestreador: CONSULTA_EDICION → todos los iconos habilitados.
  // Resto de roles: CONSULTA → solo iconos Inicio y archivo (📂) habilitados;
  // el botón "Iniciar muestreo/Iniciar Local" queda deshabilitado.
  const canEdit = puedeEditar(rol, PANTALLAS.ESTIMATION_HEADER);

  // Determine pending verification by inspecting local records
  const hasPendingVerification =
    Array.isArray(registrosLocales) &&
    registrosLocales.some((r) => r.verificado !== true);

  console.log('=== HEADER PAGE ===');
  console.log('local registros count:', registrosLocales.length);
  console.log('hasPendingVerification:', hasPendingVerification);

const setField = (fieldName, value) => {
  setHeader((prev) => ({
    ...prev,
    [fieldName]: value,
    }));
  };
  const [errors, setErrors] = useState([]);

  const gf = useMemo(() => deriveGf(header?.Forza, header?.Semana), [header]);

  const guardarFirebase = async () => {
    const computedGf = `${header.Forza}-${header.Semana}`;
    const year = new Date().getFullYear();

    // Build canonical uniqueKey using the shared helper
    const headerWithGF = { ...header, GF: computedGf, anio: year };
    const uniqueKey = crearUniqueKey(headerWithGF);

    if (!isOnline) {
      // Check for local duplicates before saving offline
      if (duplicateWithoutGFExists(headerWithGF, registrosLocales)) {
        alert('Ya existe una estimación para esta Cosecha, Tipo, Lote, Parcela y Año.');
        return;
      }

      const ok = guardarRegistroLocal({
        ...header,
        GF: computedGf,
        uniqueKey,
        anio: year,
      });

      if (ok) {
        alert('Encabezado guardado local');
        console.log('HEADER QUE SE ENVIA:', {
          ...header,
          GF: computedGf,
          uniqueKey,
        });
        sessionStorage.removeItem('savedSamplingId');
        sessionStorage.removeItem('verifiedSamplingId');
        
        navigate('/estimaciones/muestreo', {
          state: {
            header: {
              ...header,
              GF: computedGf,
              uniqueKey,
              anio: year,
            },
            mode: 'capture',
          },
        });
        return;
      }

      alert('No se pudo guardar localmente');
      return;
    }

    try {
      const validation = validateEstimationHeader(header);
      if (!validation.ok) {
        setErrors(validation.errors || []);
        return;
      }

      const payload = {
        ...header,
        uniqueKey,
        anio: year,
        GF: computedGf,
      };

      console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(payload, null, 2));
      console.log('GF MINUSCULA:', payload.gf);

      const finalPayload = { ...payload };
      if ('gf' in finalPayload) {
        delete finalPayload.gf;
      }

      console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(finalPayload, null, 2));

      // --- Firebase duplicate check before creating new document ---
      const dupSnap = await getDocs(
        query(
          collection(db, 'estimaciones'),
          where('Cosecha', '==', header.Cosecha)
        )
      );
      const hasDuplicate = dupSnap.docs.some((doc) =>
        sameEstimationWithoutGF(headerWithGF, doc.data())
      );
      if (hasDuplicate) {
        alert('Ya existe una estimación para esta Cosecha, Tipo, Lote, Parcela y Año.');
        return;
      }
      // --- End duplicate check ---

      const docRef = await addDoc(
          collection(db, 'estimaciones'),
          {
            ...finalPayload,
            fechaCreacion: new Date(),
          }
        );

// Guarda el ID recién creado
    sessionStorage.setItem(
      'savedSamplingId',
      docRef.id
    );

    console.log(
      'savedSamplingId:',
      docRef.id
    );


      console.log('ID Firebase creado:', docRef.id);
      alert('Registro guardado en Firebase');

      navigate('/estimaciones/muestreo', {
        state: {
          estimationId: docRef.id,
          header: {
            ...header,
            GF: computedGf,
            uniqueKey,
          },
          mode: 'capture',
        },
      });
    } catch (error) {
      console.error(error);
      alert('Error al guardar');
    }
  };

  const handleSubmit = async () => {
    const payload = {
      Cosecha: header.Cosecha,
      Tipo: header.Tipo,
      Semana: header.Semana,
      Forza: header.Forza,
      Lote: Number(header.Lote),
      Parcela: Number(header.Parcela),
      Poblacion: Number(header.Poblacion),
      PtasEstac: Number(header.PtasEstac),
      PtasMues: Number(header.PtasMues),
      Area: Number(header.Area),
      GF: String(gf),
    };

    console.log('PAYLOAD:', payload);

        // Verifica si hay una toma pendiente basándose en registros locales
        const hasPendingVerificationLocal =
          Array.isArray(registrosLocales) &&
          registrosLocales.some((r) => r.verificado !== true);

        if (hasPendingVerificationLocal) {
          alert('Debe verificar que la Toma Física haya quedado guardada');
          return;
        }

        navigate('/estimaciones/muestreo', {
  state: {
    header: payload,
    mode: 'capture',
  },
});

};

const handleContinuarMuestreo = () => {

  const showContinueMuestreo = false;

    if (showContinueMuestreo) {

      navigate('/estimaciones/muestreo', {
        state: {
          header,
          mode: 'capture',
        },
      });

    } else {

      handleSubmit();

    }

  }

  const homePath = '/';

  return (
    <div className="estimation-header-page">
      <header
        className="estimation-header-page__bar"
        style={{
          background: '#15803d',
          width: '100vw',
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          padding: '8px 12px',
          boxSizing: 'border-box',

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        {/* Icono Inicio: siempre visible para todos los roles */}
        <Link
          className="estimation-header-page__back"
          to={homePath}
          style={{
            background: '#16a34a',/* Verde agrícola */
            color: '#ffffff',/* Color blanco para el texto del botón */
            fontWeight: 800,
            fontSize: 13,
            textDecoration: 'none',
            borderRadius: 10,
            padding: '7px 10px',
            minHeight: 34,

            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',

            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.20)',
            flexShrink: 0,
          }}
        >
          Inicio
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 700,
            color: '#ffffff',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isOnline ? '#22c55e' : '#ef4444',
              display: 'inline-block',
            }}
          />
          {isOnline ? 'En línea' : 'Sin línea'}
        </div>

        {/* Botón "Iniciar muestreo / Iniciar Local":
            Solo habilitado para roles con CONSULTA_EDICION (Muestreador).
            Para roles con solo CONSULTA queda deshabilitado. */}
        <button
          type="button"
          onClick={guardarFirebase}
          disabled={!canEdit || hasPendingVerification}
          style={{
            background: '#166534',
            color: '#ffffff',
            border: 'none',
            borderRadius: 10,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 700,
            minHeight: 38,
            width: 88,
            flexShrink: 0,
            opacity: (!canEdit || hasPendingVerification) ? 0.5 : 1,
            cursor: (!canEdit || hasPendingVerification) ? 'not-allowed' : 'pointer',
          }}
        >
          {isOnline ? 'Iniciar muestreo' : 'Iniciar Local'}
        </button>

        {/* Icono archivo (📂): siempre visible para todos los roles */}
        <button
          type="button"
          onClick={() => navigate('/estimaciones/locales')}
          disabled={hasPendingVerification}
          style={{
            background: '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: 10,
            width: 36,
            height: 36,
            fontSize: 16,

            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',

            opacity: hasPendingVerification ? 0.5 : 1,
            cursor: hasPendingVerification ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          📂
        </button>
      </header>

      <main className="estimation-header-page__body">
        <h1 className="estimation-header-page__heading">Encabezado Toma Física</h1>
        <p className="estimation-header-page__hint" />

        {errors.length > 0 ? (
          <ul className="estimation-header-page__errors" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        <div className="estimation-row-two-columns">
          <div className="estimation-field">
            <label className="field-label" htmlFor="Cosecha">
              Cosecha
            </label>
            <select
              id="Cosecha"
              name="Cosecha"
              className="field-input compact-select"
              value={header.Cosecha}
              autoComplete="new-password"
              onChange={(e) => setField('Cosecha', e.target.value)}
              disabled={hasPendingVerification}
            >
              <option value="">Seleccione</option>
              <option value="PC">P-C</option>
              <option value="RC">R-C</option>
            </select>
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="Tipo">
              Tipo
            </label>
            <select
              id="Tipo"
              className="field-input compact-select"
              value={header.Tipo}
              onChange={(e) => setField('Tipo', e.target.value)}
              disabled={hasPendingVerification}
            >
              <option value="">Seleccione</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
              <option value="C5">C5</option>
            </select>
          </div>
        </div>

        <div className="estimation-header-grid">
          <div className="estimation-field">
            <label className="field-label" htmlFor="Forza">
              Forza
            </label>
            <input
              id="Forza"
              className="field-input"
              type="number"
              value={header.Forza}
              disabled={hasPendingVerification}
              onChange={(e) => setField('Forza', e.target.value)}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="Semana">
              Semana
            </label>
            <input
              id="Semana"
              className="field-input"
              type="number"
              min="1"
              value={header.Semana}
              disabled={hasPendingVerification}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setField('Semana', '');
                  return;
                }
                const num = Number(value);
                if (num >= 1 && num <= 53) {
                  setField('Semana', value);
                }
              }}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="Lote">
              Lote
            </label>
            <input
              id="Lote"
              className="field-input"
              type="number"
              value={header.Lote}
              disabled={hasPendingVerification}
              onChange={(e) => setField('Lote', e.target.value)}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="Parcela">
              Parcela / Sección
            </label>
            <input
              id="Parcela"
              className="field-input"
              type="number"
              value={header.Parcela}
              disabled={hasPendingVerification}
              onChange={(e) => setField('Parcela', e.target.value)}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="Poblacion">
              Población
            </label>
            <input
              id="Poblacion"
              className="field-input"
              type="number"
              value={header.Poblacion}
              disabled={hasPendingVerification}
              onChange={(e) => setField('Poblacion', e.target.value)}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="PtasEstac">
              Plantas Estación
            </label>
            <input
              id="PtasEstac"
              className="field-input"
              type="number"
              value={header.PtasEstac}
              disabled={hasPendingVerification}
              onChange={(e) => setField('PtasEstac', e.target.value)}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="PtasMues">
              Plantas Muestras
            </label>
            <input
              id="PtasMues"
              className="field-input"
              type="number"
              value={header.PtasMues}
              disabled={hasPendingVerification}
              onChange={(e) => setField('PtasMues', e.target.value)}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="Area">
              Area
            </label>
            <input
              id="Area"
              className="field-input"
              type="number"
              step="0.01"
              value={header.Area}
              disabled={hasPendingVerification}
              onChange={(e) => setField('Area', e.target.value)}
            />
          </div>
          <label className="field-label estimation-header-grid__full" htmlFor="GF">
            Grupo Forza
          </label>
          <input
            id="GF"
            className="field-input field-readonly estimation-header-grid__full"
            readOnly
            value={gf || '—'}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '20px',
            }}
          >
            {false ? (
              <button
                type="button"
                className="validate-button estimation-header-page__continue"
                onClick={guardarFirebase}
              >
                Continuar Muestreo
              </button>
            ) : null}
          </div>
        </div>
          </main>
  </div>
);

}
