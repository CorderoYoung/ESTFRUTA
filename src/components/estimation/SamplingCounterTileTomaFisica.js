function SamplingCounterTileTomaFisica({
  label,
  count,
  onIncrement,
  onDecrement,
  showActions = true,
  variant = 'default',
  className = '',
}) {

  const rootClass =
  variant === 'compact'
    ? 'sampling-tile sampling-tile--compact'
    : variant === 'readonly'
    ? 'sampling-tile sampling-tile--readonly'
    : 'sampling-tile';

  return (
    <div className={`${rootClass} ${className}`}>

      <span className="sampling-tile__label">
        {label}
      </span>

      <span
        className="sampling-tile__count"
        aria-live="polite"
      >
        {count}
      </span>

      {showActions && (

        <div className="sampling-tile__actions">

          <button
            type="button"
            className="sampling-tap sampling-tap--plus"
            onClick={onIncrement}
          >
            +
          </button>

          <button
            type="button"
            className="sampling-tap sampling-tap--minus"
            onClick={onDecrement}
          >
            -
          </button>

        </div>

      )}

    </div>
  );
}

export default SamplingCounterTileTomaFisica;