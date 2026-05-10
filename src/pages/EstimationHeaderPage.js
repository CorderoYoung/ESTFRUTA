import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROLE_ROUTES } from '../constants/roles';
import {
  
} from '../constants/estimationContext';
import { deriveGF } from '../domain/estimationBusinessRules';
import { validateEstimationHeader } from '../domain/estimationHeaderRules';
import { useDebouncedEffect } from '../hooks/useDebouncedEffect';
import {
  draftHasSamplingProgress,
  getHeaderFingerprint,
  loadOperationalDraft,
  saveOperationalDraft,
} from '../services/operationalDraftStorage';

const ESTIMATION_HEADER_STORAGE_KEY = 'estimation_header';

const emptyHeader = {
  Tipo: '',
  Cosecha: '',
  Semana: '',
  Forza: '',
  Lote: '',
  Parcela: '',
  Poblacion: '',
  PtasEstac: '',
  PtasMues: '',
  Area: '',
};

function initialHeaderFromDraft() {
  const draft = loadOperationalDraft();
  if (!draft?.header || typeof draft.header !== 'object') {
    return { ...emptyHeader };
  }
  const h = draft.header;
  return {
    Tipo: h.Tipo ?? '',
    Cosecha: h.Cosecha ?? '',
    Semana: h.Semana ?? '',
    Forza: h.Forza ?? '',
    Lote: h.Lote ?? '',
    Parcela: h.Parcela ?? '',
    Poblacion: h.Poblacion ?? '',
    PtasEstac: h.PtasEstac ?? '',
    PtasMues: h.PtasMues ?? '',
    Area: h.Area ?? '',
  };
}

function EstimationHeaderPage({ user, onLogout }) {
  const navigate = useNavigate();
  const [header, setHeader] = useState(initialHeaderFromDraft);
  const [errors, setErrors] = useState([]);

  const gf = useMemo(
    () => deriveGF(header.Forza, header.Semana),
    [header.Forza, header.Semana]
  );

  const draftSnapshot = loadOperationalDraft();
  const showContinueMuestreo =
    draftHasSamplingProgress(draftSnapshot) &&
    Boolean(draftSnapshot?.header?.GF);

  useDebouncedEffect(
    () => {
      const computedGf = deriveGF(header.Forza, header.Semana);
      const fullHeader = {
        ...header,
        ...(computedGf ? { GF: computedGf } : {}),
      };
      const prev = loadOperationalDraft();
      let detalle = prev?.detalle ?? [];
      let activeTab = prev?.activeTab ?? 'sizes';
      const newFp = getHeaderFingerprint(fullHeader);
      if (prev?.headerFingerprint && prev.headerFingerprint !== newFp) {
        detalle = [];
        activeTab = 'sizes';
      }
      saveOperationalDraft({
        header: fullHeader,
        detalle,
        activeTab,
      });
    },
    [header],
    400
  );

  function setField(name, value) {
    setHeader((h) => ({ ...h, [name]: value }));
  }

  function handleIniciarMuestreo() {
    const validation = validateEstimationHeader(header);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors([]);
    const payload = { ...header, GF: validation.derivedGF };
    try {
      window.sessionStorage.setItem(
        ESTIMATION_HEADER_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch {
      // ignore quota
    }
    const prev = loadOperationalDraft();
    const newFp = getHeaderFingerprint(payload);
    const detalle =
      prev?.headerFingerprint === newFp ? prev.detalle ?? [] : [];
    saveOperationalDraft({
      header: payload,
      detalle,
      activeTab: prev?.headerFingerprint === newFp ? prev.activeTab : 'sizes',
    });
    navigate('/estimaciones/muestreo', { state: { header: payload } });
  }

  function handleContinuarMuestreo() {
    const draft = loadOperationalDraft();
    if (!draft?.header?.GF) return;
    try {
      window.sessionStorage.setItem(
        ESTIMATION_HEADER_STORAGE_KEY,
        JSON.stringify(draft.header)
      );
    } catch {
      // ignore
    }
    navigate('/estimaciones/muestreo', { state: { header: draft.header } });
  }

  const homePath = ROLE_ROUTES[user?.Rol] || '/login';

  return (
    <div className="estimation-header-page">
      <header className="estimation-header-page__bar">
        <Link className="estimation-header-page__back" to={homePath}>
          Inicio
        </Link>
        <span className="estimation-header-page__title">Cabecera</span>
        <button
          type="button"
          className="estimation-header-page__linkish"
          onClick={onLogout}
        >
          Salir
        </button>
      </header>

      <main className="estimation-header-page__body">
        <h1 className="estimation-header-page__heading">Nueva estimacion</h1>
        <p className="estimation-header-page__hint">
          Paso 1 de 2: contexto. El borrador se guarda solo (local y sesion).
        </p>

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
              <option value="PC">PC</option>
              <option value="RC">RC</option>
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


          <label className="field-label estimation-header-grid__full" htmlFor="gf">
            GF (calculado)
          </label>
          <input
            id="gf"
            className="field-input field-readonly estimation-header-grid__full"
            readOnly
            value={gf || '—'}
          />
        </div>

        {showContinueMuestreo ? (
          <button
            type="button"
            className="validate-button estimation-header-page__continue"
            onClick={handleContinuarMuestreo}
          >
            Continuar muestreo (borrador)
          </button>
        ) : null}

        <button
          type="button"
          className="validate-button estimation-header-page__cta"
          onClick={handleIniciarMuestreo}
        >
          Iniciar Muestreo
        </button>
      </main>
    </div>
  );
}

export default EstimationHeaderPage;
