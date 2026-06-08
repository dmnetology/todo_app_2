import './Input.scss';

function Input({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  autoComplete,
  required = false,
  minLength,
  error,
  helpText,
  name,
}) {
  const hasError = Boolean(error);

  return (
    <div className={`input ${hasError ? 'input--error' : ''}`}>
      {label && (
        <label className="input__label" htmlFor={id}>
          {label}
        </label>
      )}

      <div className="input__control-wrapper">
        <input
          className={`input__control`}
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          aria-invalid={hasError}
          aria-describedby={hasError || helpText ? `${id}-help` : undefined}
        />
      </div>

      {helpText && !hasError && (
        <small id={`${id}-help`} className="input__help">
          {helpText}
        </small>
      )}

      {hasError && (
        <small id={`${id}-help`} className="input__error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export default Input;