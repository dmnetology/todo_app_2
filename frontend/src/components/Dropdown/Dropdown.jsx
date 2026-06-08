import './Dropdown.scss';

function Dropdown({
  id,
  label,
  value,
  onChange,
  options = [],
  helpText,
  error,
  name,
}) {
  const hasError = Boolean(error);

  return (
    <div className={`dropdown ${hasError ? 'dropdown--error' : ''}`}>
      {label && (
        <label className="dropdown__label" htmlFor={id}>
          {label}
        </label>
      )}

      <select
        className="dropdown__select"
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        aria-invalid={hasError}
        aria-describedby={hasError || helpText ? `${id}-help` : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {helpText && !hasError && (
        <small id={`${id}-help`} className="dropdown__help">
          {helpText}
        </small>
      )}

      {hasError && (
        <small id={`${id}-help`} className="dropdown__error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export default Dropdown;