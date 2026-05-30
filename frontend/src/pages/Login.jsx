import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedLogin = login.trim();

    if (!isValidEmail(trimmedLogin)) {
      setError('Введите логин в формате email, например user@example.com');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: trimmedLogin,
          password,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Ошибка HTTP: ${response.status}`);
      }

      const data = await response.json();

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      if (onLogin) onLogin();

      navigate('/list');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>Вход</h1>

      <form onSubmit={handleSubmit} aria-describedby={error ? 'login-error' : undefined}>
        <div>
          <label htmlFor="login">Email</label>
          <input
            id="login"
            name="login"
            type="email"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            required
            placeholder="user@example.com"
          />
          <small>
            В качестве логина используйте email, указанный при регистрации.
          </small>
        </div>

        <div>
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            minLength={6}
          />
          <small>
            Минимальная длина пароля — 6 символов.
          </small>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>

      {error && (
        <p id="login-error" role="alert" aria-live="assertive" style={{ color: 'red' }}>
          {error}
        </p>
      )}
    </main>
  );
};

export default Login;