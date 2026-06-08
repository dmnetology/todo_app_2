import './Button.scss';

function Button({ type = 'button', children, ...props }) {
  return (
    <button className="button" type={type} {...props}>
      {children}
    </button>
  );
}

export default Button;