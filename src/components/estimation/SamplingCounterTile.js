function SamplingCounterTile({
  label,
  count,
  onIncrement,
  onDecrement,
  variant = 'default',
}) {
  const rootClass =
    variant === 'compact'
      ? 'sampling-tile sampling-tile--compact'
      : 'sampling-tile';
  return (
    <div className={rootClass}>
      <span className="sampling-tile__label">{label}</span>
      <span className="sampling-tile__count" aria-live="polite">
        {count}
      </span>
      <div className="sampling-tile__actions">
      <button
        type="button"
        className="sampling-tap sampling-tap--plus"
        onClick={onIncrement}
        aria-label={`Mas ${label}`}
      >
        +
      </button>

      <button
        type="button"
        className="sampling-tap sampling-tap--minus"
        onClick={onDecrement}
        aria-label={`Menos ${label}`}
      >
        −
      </button>
    </div>
    </div>
  );
}

export default SamplingCounterTile;
