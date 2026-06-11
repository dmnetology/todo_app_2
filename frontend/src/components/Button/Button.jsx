import './Button.scss';

function Button({ type = 'button', className = '', children, ...props }) {
  return (
    <button className={`button ${className}`.trim()} type={type} {...props}>
      {children}
    </button>
  );
}

export default Button;