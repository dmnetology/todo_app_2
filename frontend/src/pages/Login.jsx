import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../components/Input/Input';
import Button from '../components/Button/Button';
import './Login.scss';

const Login = ({ onLogin }) => {
  const [mode, setMode] = useState('login'); // login | register

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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

    if (mode === 'register') {
      if (firstName.trim().length < 1) {
        setError('Введите имя');
        return;
      }

      if (lastName.trim().length < 1) {
        setError('Введите фамилию');
        return;
      }
    }

    setLoading(true);

    try {
      const url =
        mode === 'login'
          ? 'http://localhost:8000/auth/login'
          : 'http://localhost:8000/auth/register';

      const body =
        mode === 'login'
          ? {
              login: trimmedLogin,
              password,
            }
          : {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              login: trimmedLogin,
              password,
            };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Ошибка HTTP: ${response.status}`);
      }

      if (mode === 'register') {
        setMode('login');
        setFirstName('');
        setLastName('');
        setPassword('');
        setError('Регистрация успешна. Теперь войдите в аккаунт.');
        return;
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
    <main className="login-page">
      <section className="login-page__layout">
        <div className="login-page__info">
          <span className="login-page__eyebrow">Добро пожаловать</span>
          <h1 className="login-page__title">
            {mode === 'login' ? 'Вход в To-Do App' : 'Регистрация в To-Do App'}
          </h1>
          <p className="login-page__text">
            {mode === 'login'
              ? 'Авторизуйтесь, чтобы получить доступ к своим задачам, избранному, категориям и персональному рабочему пространству.'
              : 'Создайте новый аккаунт, чтобы начать работу с задачами.'}
          </p>

          <div className="login-page__benefits">
            <div className="login-page__benefit">
              <h3 className="login-page__benefit-title">Быстрый доступ</h3>
              <p className="login-page__benefit-text">
                После входа вы сразу попадаете в рабочую область со списком задач и фильтрами.
              </p>
            </div>

            <div className="login-page__benefit">
              <h3 className="login-page__benefit-title">Безопасная авторизация</h3>
              <p className="login-page__benefit-text">
                Система использует access и refresh токены для удобной и защищённой работы с аккаунтом.
              </p>
            </div>

            <div className="login-page__benefit">
              <h3 className="login-page__benefit-title">Единый интерфейс</h3>
              <p className="login-page__benefit-text">
                Все страницы приложения оформлены в одном стиле, чтобы работа была комфортной и понятной.
              </p>
            </div>
          </div>
        </div>

        <div className="login-page__form-card">
          <h2 className="login-page__form-title">
            {mode === 'login' ? 'Войти в аккаунт' : 'Создать аккаунт'}
          </h2>

          <form
            onSubmit={handleSubmit}
            aria-describedby={error ? 'login-error' : undefined}
            className="login-form"
          >
            {mode === 'register' && (
              <>
                <Input
                  id="first_name"
                  name="first_name"
                  type="text"
                  label="Имя"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />

                <Input
                  id="last_name"
                  name="last_name"
                  type="text"
                  label="Фамилия"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </>
            )}

            <Input
              id="login"
              name="login"
              type="email"
              label="Email"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              required
              placeholder="user@example.com"
              helpText={
                 mode === 'login'
                 ? 'В качестве логина используйте email, указанный при регистрации.'
                 : 'Укажите email нового пользователя.'
              }
            />

            <Input
              id="password"
              name="password"
              type="password"
              label="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              helpText={
                mode === 'login'
                ? 'Минимальная длина пароля — 6 символов.'
                : 'Придумайте пароль не менее 6 символов.'
              }
            />

            {error && (
              <p id="login-error" role="alert" aria-live="assertive" className="login-form__error">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="login-form__submit">
              {loading
                ? mode === 'login'
                  ? 'Вход...'
                  : 'Регистрация...'
                : mode === 'login'
                  ? 'Войти'
                  : 'Зарегистрироваться'}
            </Button>

            <button
              type="button"
              className="login-form__switch"
              onClick={() => {
                setError(null);
                setMode(mode === 'login' ? 'register' : 'login');
                setFirstName('');
                setLastName('');
                setLogin('');
                setPassword('');
              }}
            >
              {mode === 'login'
                ? 'Нет аккаунта? Зарегистрироваться'
                : 'Уже есть аккаунт? Войти'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default Login;