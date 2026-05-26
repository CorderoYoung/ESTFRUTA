import { useEffect, useState } from 'react';

function SamplingCounterTileConsultaEdicion({
  label,
  count,
  className = '',
  editMode = false,
  onChange,
}) {
  const [inputValue, setInputValue] =
  useState(
    count > 0 ? String(count) : ''
    );

  useEffect(() => {

  setInputValue(
    count > 0 ? String(count) : ''
  ) ;

    }, [count]);

  const handleInputChange = (e) => {
    const rawValue = e.target.value;
    setInputValue(rawValue);
    if (rawValue === '') {

      onChange?.(0);

      return;
    }

    const parsed = Number(rawValue);

    if (
      Number.isFinite(parsed) &&
      parsed >= 0
    ) {

      onChange?.(Math.trunc(parsed));

    }

    console.log('EDITANDO:', {
      label,
      rawValue,
      parsed,
      editMode,
      count,
    });

   
  };

  return (

    <div className={`sampling-tile-readonly ${className}`}>

      <span className="sampling-tile-readonly__label">
        {label}
      </span>

      <input
        type="text"
        value={inputValue}
        inputMode="numeric"
        className="sampling-tile-readonly__input"

        readOnly={!editMode}

        onClick={() => {

          if (inputValue === '0') {

            setInputValue('');

          }

        }}

        onChange={handleInputChange}
      />

    </div>
  );
}

export default SamplingCounterTileConsultaEdicion;