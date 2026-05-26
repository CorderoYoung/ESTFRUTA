import React, { useMemo, useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { collection, addDoc } from 'firebase/firestore';
import useOffline from '../hooks/useOffline';
import { db } from '../firebaseConfig';

import { deriveGf } from '../domain/estimationBusinessRules';
import { validateEstimationHeader } from '../domain/estimationHeaderRules';
import { requestCreateEstimation } from '../services/estimationService';
import {
  draftHasSamplingProgress,
  getHeaderFingerprint,
  // loadOperationalDraft, // PHASE 2: Draft loading disabled
} from '../services/operationalDraftStorage';

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

export default function EstimationHeaderPage({ user, onLogout }) {
  const navigate = useNavigate();
  const { isOnline, guardarRegistroLocal } = useOffline();
  const [header, setHeader] = useState({ ...emptyHeader });
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
    const uniqueKey =
      `${header.Tipo}-${header.Lote}-${header.Parcela}-${year}`;

    if (!isOnline) {
      const ok = guardarRegistroLocal({
        ...header,
        GF: computedGf,
        uniqueKey,
      });

      if (ok) {
        alert('Encabezado guardado local');
        console.log('HEADER QUE SE ENVIA:', {
          ...header,
          GF: computedGf,
          uniqueKey,
        });

        navigate('/estimaciones/muestreo', {
          state: {
            header: {
              ...header,
              GF: computedGf,
              uniqueKey,
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
        GF: computedGf,
      };

      console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(payload, null, 2));
      console.log('GF MINUSCULA:', payload.gf);

      const finalPayload = { ...payload };
      if ('gf' in finalPayload) {
        delete finalPayload.gf;
      }

      console.log('PAYLOAD FINAL FIREBASE', JSON.stringify(finalPayload, null, 2));

      const docRef = await addDoc(collection(db, 'estimaciones'), {
        ...finalPayload,
        fechaCreacion: new Date(),
      });


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
          mode: 'continue',
        },
      });
    } else {
      handleSubmit();
    }
  };

  const homePath = '/';

  return (
    <div className="estimation-header-page">
      <header className="estimation-header-page__bar">
        <Link className="estimation-header-page__back" to={homePath}>
          Inicio
        </Link>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span className="estimation-header-page__title" />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              fontWeight: 600,
              color: isOnline ? '#1a7f37' : '#dc2626',
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

          <button
            type="button"
            onClick={guardarFirebase}
            style={{
              marginLeft: 'auto',
              background: isOnline ? '#166534' : '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              minHeight: '34px',
              width: 'auto',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            {isOnline ? 'Iniciar' : 'Local'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/estimaciones/locales')}
            style={{
              marginLeft: 80,
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              width: 36,
              height: 36,
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            🛢️
          </button>

          {false ? (
            <button
              type="button"
              className="validate-button estimation-header-page__continue"
              onClick={guardarFirebase}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                minHeight: '36px',
                width: 'auto',
              }}
            >
              Continuar
            </button>
          ) : null}
        </div>
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
              onChange={(e) => setField('Lote', e.target.value)}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="Parcela">
              Parcela
            </label>
            <input
              id="Parcela"
              className="field-input"
              type="number"
              value={header.Parcela}
              onChange={(e) => setField('Parcela', e.target.value)}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="Poblacion">
              Poblacion
            </label>
            <input
              id="Poblacion"
              className="field-input"
              type="number"
              value={header.Poblacion}
              onChange={(e) => setField('Poblacion', e.target.value)}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="PtasEstac">
              PtasEstac
            </label>
            <input
              id="PtasEstac"
              className="field-input"
              type="number"
              value={header.PtasEstac}
              onChange={(e) => setField('PtasEstac', e.target.value)}
            />
          </div>
          <div className="estimation-field">
            <label className="field-label" htmlFor="PtasMues">
              PtasMues
            </label>
            <input
              id="PtasMues"
              className="field-input"
              type="number"
              value={header.PtasMues}
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
              onChange={(e) => setField('Area', e.target.value)}
            />
          </div>
          <label className="field-label estimation-header-grid__full" htmlFor="GF">
            GF (calculado)
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
