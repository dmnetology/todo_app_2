import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Button from '../Button/Button';
import './Navbar.scss';

function Navbar({ isAuthenticated, user, isOnline, onLogout }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      setTime(
        now.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    updateTime();

    const timerId = setInterval(updateTime, 1000);

    return () => clearInterval(timerId);
  }, []);

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <nav className="navbar__nav" aria-label="Основная навигация">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
          >
            Главная
          </NavLink>

          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
          >
            Список задач
          </NavLink>

          <NavLink
            to="/favourites"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
          >
            Избранное
          </NavLink>

          <NavLink
            to="/about"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
          >
            О нас
          </NavLink>

          <NavLink
            to="/categories"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
          >
            Категории
          </NavLink>
        </nav>

        <div className="navbar__meta">
          <span className="navbar__clock" aria-label="Текущее время">
            {time}
          </span>

          <span
            className={`navbar__status ${
              isOnline ? 'navbar__status--online' : 'navbar__status--offline'
            }`}
          >
            <span className="navbar__status-dot" aria-hidden="true" />
            {isOnline ? 'Онлайн' : 'Офлайн'}
          </span>

          {isAuthenticated && user && (
            <span className="navbar__user">
              Пользователь: {user.first_name} {user.last_name}
            </span>
          )}

          {isAuthenticated ? (
            <Button
              type="button"
              onClick={onLogout}
              className="navbar__button navbar__button--logout"
            >
              Выход
            </Button>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `navbar__link navbar__link--auth ${
                  isActive ? 'navbar__link--active' : ''
                }`
              }
            >
              Вход
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;