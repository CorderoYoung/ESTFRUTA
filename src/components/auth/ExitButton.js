function ExitButton({ onClick }) {
  return (
    <button className="exit-link" type="button" onClick={onClick}>
      <span className="exit-icon" aria-hidden="true">
        <span className="exit-icon-line" />
      </span>
      <span>Salir</span>
    </button>
  );
}

export default ExitButton;
